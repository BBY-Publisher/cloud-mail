import { eq } from 'drizzle-orm';
import orm from '../entity/orm';
import signature from '../entity/signature';
import BizError from '../error/biz-error';
import settingService from './setting-service';
import emailUtils from '../utils/email-utils';
import { t } from '../i18n/i18n';

const signatureService = {
	async list(c) {
		const { domainList } = await settingService.query(c);
		const domains = domainList.map(normalizeDomain);
		const rows = await orm(c).select().from(signature).all();
		const rowMap = Object.fromEntries(rows.map(row => [normalizeDomain(row.domain), row]));

		return domains.map(domain => ({
			signatureId: rowMap[domain]?.signatureId,
			domain,
			content: rowMap[domain]?.content || '',
			enabled: rowMap[domain]?.enabled ?? 1,
			createTime: rowMap[domain]?.createTime,
			updateTime: rowMap[domain]?.updateTime
		}));
	},

	async set(c, params) {
		let { domain, content = '', enabled = 1 } = params;
		domain = normalizeDomain(domain);
		await assertManagedDomain(c, domain);

		content = sanitizeSignatureContent(content);
		enabled = Number(enabled) === 1 ? 1 : 0;

		const row = await this.selectByDomain(c, domain);
		if (row) {
			return await orm(c).update(signature).set({
				content,
				enabled,
				updateTime: new Date().toISOString()
			}).where(eq(signature.domain, domain)).returning().get();
		}

		return await orm(c).insert(signature).values({ domain, content, enabled }).returning().get();
	},

	async getByEmail(c, params) {
		const email = params.email || '';
		const domain = normalizeDomain(params.domain || emailUtils.getDomain(email));
		await assertManagedDomain(c, domain);
		const row = await this.selectEnabledByDomain(c, domain);

		return {
			domain,
			content: row?.content || '',
			enabled: row?.enabled ?? 0
		};
	},

	async selectByDomain(c, domain) {
		return await orm(c).select().from(signature).where(eq(signature.domain, normalizeDomain(domain))).get();
	},

	async selectEnabledByDomain(c, domain) {
		const row = await this.selectByDomain(c, domain);
		if (!row || Number(row.enabled) !== 1 || !row.content) {
			return null;
		}
		return row;
	}
};

async function assertManagedDomain(c, domain) {
	const { domainList } = await settingService.query(c);
	const domains = domainList.map(normalizeDomain);
	if (!domains.includes(domain)) {
		throw new BizError(t('notExistDomain'));
	}
}

function normalizeDomain(domain = '') {
	return String(domain).trim().replace(/^@/, '').toLowerCase();
}

function sanitizeSignatureContent(content = '') {
	return String(content)
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
		.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
		.trim();
}

export { normalizeDomain, sanitizeSignatureContent };
export default signatureService
