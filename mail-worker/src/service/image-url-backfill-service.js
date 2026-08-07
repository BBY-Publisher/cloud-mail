import { parseHTML } from 'linkedom';
import orm from '../entity/orm';
import { email } from '../entity/email';
import { att } from '../entity/att';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import settingService from './setting-service';
import domainUtils from '../utils/domain-uitls';
import { attConst } from '../const/entity-const';

export const IMAGE_URL_BACKFILL_DEFAULT_LIMIT = 50;
export const IMAGE_URL_BACKFILL_MAX_LIMIT = 200;
export const IMAGE_URL_PLACEHOLDER = '{{domain}}';

export function normalizeBackfillDomain(value) {
	if (!value) return '';
	const normalized = domainUtils.toOssDomain(String(value).trim());
	return normalized ? normalized.replace(/\/+$/, '') : '';
}

export function buildDomainPrefixes(currentDomain, previousDomains = []) {
	const set = new Set();
	if (currentDomain) set.add(currentDomain);
	for (const d of previousDomains) {
		if (d) set.add(d);
	}
	return Array.from(set).map(d => d + '/');
}

function normalizeLimit(value) {
	const limit = Number(value);
	if (!Number.isInteger(limit) || limit < 1) {
		return IMAGE_URL_BACKFILL_DEFAULT_LIMIT;
	}
	return Math.min(limit, IMAGE_URL_BACKFILL_MAX_LIMIT);
}

// 通过 cid: 引用查找该邮件的 EMBED 附件，返回 contentId -> key 的映射。
async function loadEmbedKeyMap(c, emailIds) {
	if (!emailIds.length) return new Map();
	const rows = await orm(c).select({
		emailId: att.emailId,
		contentId: att.contentId,
		key: att.key
	}).from(att).where(and(
		eq(att.type, attConst.type.EMBED),
		sql`${att.emailId} IN (${sql.join(emailIds.map(id => sql`${id}`), sql`, `)})`,
		sql`${att.contentId} IS NOT NULL`
	)).all();
	const map = new Map(); // `${emailId}:${contentId}` -> key
	for (const row of rows) {
		const cid = String(row.contentId || '').replace(/^<|>$/g, '').trim();
		if (!cid) continue;
		map.set(`${row.emailId}:${cid}`, row.key);
	}
	return map;
}

// 改写一段 HTML 中的 <img> 引用，把 cid: / 旧域名 URL 转为 {{domain}}key 占位符。
// 返回 { content, changes: [{ type, ref, replaced }] }；changes 用于日志与统计。
export function rewriteHtmlImages(html, opts = {}) {
	const { domainPrefixes = [], embedKeyByRef = { emailId: 0, lookup: () => null } } = opts;
	if (!html) return { content: html || '', changes: [] };

	const { document } = parseHTML(html);
	const images = Array.from(document.querySelectorAll('img'));
	const changes = [];

	for (const img of images) {
		const rawSrc = img.getAttribute('src');
		const src = (rawSrc || '').trim();
		if (!src) continue;

		// cid: 引用：按 (emailId, contentId) 查 EMBED 附件的 R2 key。
		if (src.toLowerCase().startsWith('cid:')) {
			const cid = src.replace(/^cid:/i, '').trim();
			const refKey = `${embedKeyByRef.emailId}:${cid}`;
			const key = embedKeyByRef.lookup(refKey);
			if (key) {
				img.setAttribute('src', IMAGE_URL_PLACEHOLDER + key);
				changes.push({ type: 'cid', ref: cid, replaced: key });
			} else {
				changes.push({ type: 'cid_unresolved', ref: cid });
			}
			continue;
		}

		// 绝对 R2 URL：去掉域名前缀，统一回退到 {{domain}}key。
		for (const prefix of domainPrefixes) {
			if (src.startsWith(prefix)) {
				const key = src.slice(prefix.length).replace(/^\/+/, '');
				img.setAttribute('src', IMAGE_URL_PLACEHOLDER + key);
				changes.push({ type: 'absolute_url', ref: prefix, replaced: key });
				break;
			}
		}
	}

	return { content: changes.length ? document.toString() : html, changes };
}

const imageUrlBackfillService = {
	async backfillBatch(c, params = {}) {
		if (!c.env?.db) {
			throw new Error('D1 database not bound');
		}

		const limit = normalizeLimit(params.limit);
		const commit = params.commit === true;
		const cursor = Number(params.cursor) || 0;

		const setting = await settingService.query(c);
		const currentDomain = normalizeBackfillDomain(setting?.r2Domain);
		const previousList = Array.isArray(params.previousDomains)
			? params.previousDomains.map(normalizeBackfillDomain).filter(Boolean)
			: [];
		const domainPrefixes = buildDomainPrefixes(currentDomain, previousList);

		// 仅抓取 content 非空且 emailId > cursor 的行，避免无谓扫描。
		const page = await orm(c).select({
			emailId: email.emailId,
			content: email.content
		}).from(email).where(and(
			gt(email.emailId, cursor),
			isNotNull(email.content)
		)).orderBy(email.emailId).limit(limit).all();

		let scanned = 0;
		let rewritten = 0;
		let skipped = 0;
		const failed = [];
		let lastEmailId = cursor;

		if (page.length > 0) {
			// 一次性预加载本页所有邮件的 EMBED 附件 key 映射，避免 N+1 查询。
			const emailIds = page.map(row => row.emailId);
			const embedKeyMap = await loadEmbedKeyMap(c, emailIds);

			for (const row of page) {
				scanned += 1;
				lastEmailId = row.emailId;
				const original = row.content || '';

				const { content, changes } = rewriteHtmlImages(original, {
					domainPrefixes,
					embedKeyByRef: {
						emailId: row.emailId,
						lookup: refKey => embedKeyMap.get(refKey)
					}
				});

				// 未解析的 cid: 是历史脏数据的信号，无论 content 是否真的变了都要上报。
				const unresolved = changes.filter(c => c.type === 'cid_unresolved');
				if (unresolved.length > 0) {
					failed.push({
						emailId: row.emailId,
						reason: 'cid_unresolved',
						refs: unresolved.map(u => u.ref)
					});
					// 写入模式下，整行跳过避免落库后留下半截无法渲染的内容。
					if (commit) {
						continue;
					}
				}

				if (content === original) {
					skipped += 1;
					continue;
				}

				if (commit) {
					await c.env.db.prepare(
						'UPDATE email SET content = ? WHERE email_id = ?'
					).bind(content, row.emailId).run();
				}
				rewritten += 1;
			}
		}

		return {
			scanned,
			rewritten,
			skipped,
			failed,
			cursor: page.length < limit ? null : lastEmailId,
			complete: page.length < limit,
			commit,
			domainPrefixes
		};
	}
};

export default imageUrlBackfillService;