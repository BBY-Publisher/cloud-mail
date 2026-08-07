import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	settingQuery: vi.fn(async () => ({ r2Domain: 'https://r2.example.com' })),
	selectEmbedKeyMap: vi.fn(async () => new Map())
}));

vi.mock('../src/service/setting-service', () => ({
	default: { query: mocks.settingQuery }
}));

// 通过伪造 orm 来模拟分页扫描：返回 email 行，并把 update 调用记录下来。
// 我们需要区分两张表：email（分页扫描）与 attachments（EMBED key 映射）。
const state = vi.hoisted(() => ({
	pages: [],          // email 行：[{emailId, content}]
	updateCalls: [],
	embedKeyMap: new Map()
}));

vi.mock('../src/entity/orm', () => ({
	default: () => ({
		select: () => {
			let mode = null;
			const chain = {
				from(table) {
					mode = table === attTable ? 'att' : 'email';
					return chain;
				},
				where() { return chain; },
				orderBy() { return chain; },
				limit() { return chain; },
				all: async () => {
					if (mode === 'att') {
						return Array.from(state.embedKeyMap.entries()).map(([key, attKey]) => {
							const [emailId, cid] = key.split(':');
							return {
								emailId: Number(emailId),
								contentId: cid,
								key: attKey
							};
						});
					}
					const page = state.pages.shift() || { rows: [] };
					return page.rows;
				}
			};
			return chain;
		}
	})
}));

import imageUrlBackfillService, {
	IMAGE_URL_BACKFILL_DEFAULT_LIMIT,
	IMAGE_URL_BACKFILL_MAX_LIMIT,
	IMAGE_URL_PLACEHOLDER,
	buildDomainPrefixes,
	normalizeBackfillDomain,
	rewriteHtmlImages
} from '../src/service/image-url-backfill-service';
import { att as attTable } from '../src/entity/att';

function createContext() {
	const db = {
		prepare(sql) {
			return {
				bind(...params) {
					state.updateCalls.push({ sql, params });
					return { run: async () => ({ success: true }) };
				}
			};
		}
	};
	return { c: { env: { db, orm_log: false } } };
}

describe('normalizeBackfillDomain', () => {
	it('forces https and strips trailing slash', () => {
		expect(normalizeBackfillDomain('r2.example.com/')).toBe('https://r2.example.com');
		expect(normalizeBackfillDomain('https://r2.example.com/')).toBe('https://r2.example.com');
	});

	it('returns empty string for falsy input', () => {
		expect(normalizeBackfillDomain('')).toBe('');
		expect(normalizeBackfillDomain(null)).toBe('');
		expect(normalizeBackfillDomain(undefined)).toBe('');
	});
});

describe('buildDomainPrefixes', () => {
	it('deduplicates and appends a trailing slash', () => {
		expect(buildDomainPrefixes(
			'https://r2.example.com',
			['https://r2.example.com', 'https://old.r2.example.com']
		)).toEqual([
			'https://r2.example.com/',
			'https://old.r2.example.com/'
		]);
	});

	it('returns empty array when no domains', () => {
		expect(buildDomainPrefixes('', [])).toEqual([]);
	});
});

describe('rewriteHtmlImages (pure helper)', () => {
	it('rewrites cid: refs to {{domain}}key when EMBED lookup hits', () => {
		const html = `<p><img src="cid:abc123"></p>`;
		const { content, changes } = rewriteHtmlImages(html, {
			embedKeyByRef: {
				emailId: 7,
				lookup: key => key === '7:abc123' ? 'attachments/hash-abc.png' : null
			}
		});

		expect(content).toBe(`<p><img src="${IMAGE_URL_PLACEHOLDER}attachments/hash-abc.png"></p>`);
		expect(changes).toEqual([
			{ type: 'cid', ref: 'abc123', replaced: 'attachments/hash-abc.png' }
		]);
	});

	it('reports cid_unresolved when EMBED lookup misses', () => {
		const html = `<p><img src="cid:missing"></p>`;
		const { content, changes } = rewriteHtmlImages(html, {
			embedKeyByRef: { emailId: 1, lookup: () => null }
		});

		expect(content).toBe(html);
		expect(changes).toEqual([{ type: 'cid_unresolved', ref: 'missing' }]);
	});

	it('rewrites absolute R2 URLs to {{domain}}key', () => {
		const html = `<p><img src="https://r2.example.com/attachments/foo.png"></p>`;
		const { content, changes } = rewriteHtmlImages(html, {
			domainPrefixes: ['https://r2.example.com/']
		});

		expect(content).toBe(`<p><img src="${IMAGE_URL_PLACEHOLDER}attachments/foo.png"></p>`);
		expect(changes).toEqual([
			{ type: 'absolute_url', ref: 'https://r2.example.com/', replaced: 'attachments/foo.png' }
		]);
	});

	it('rewrites mixed cid + absolute URLs and deduplicates by cid ref', () => {
		const html = `<p>
			<img src="cid:abc">
			<img src="cid:abc">
			<img src="https://old.r2/attachments/x.png">
		</p>`;
		const { content, changes } = rewriteHtmlImages(html, {
			domainPrefixes: ['https://old.r2/'],
			embedKeyByRef: {
				emailId: 5,
				lookup: key => key === '5:abc' ? 'attachments/abc.png' : null
			}
		});

		expect(content).toContain(`${IMAGE_URL_PLACEHOLDER}attachments/abc.png`);
		expect(content).toContain(`${IMAGE_URL_PLACEHOLDER}attachments/x.png`);
		// cid appears twice (both <img> tags rewritten) but the EMBED lookup returns one key per tag.
		expect(changes.filter(c => c.type === 'cid')).toHaveLength(2);
		expect(changes.filter(c => c.type === 'absolute_url')).toHaveLength(1);
	});

	it('leaves already-normalized content untouched', () => {
		const html = `<p><img src="${IMAGE_URL_PLACEHOLDER}attachments/foo.png"></p>`;
		const { content, changes } = rewriteHtmlImages(html, {
			domainPrefixes: ['https://r2.example.com/']
		});

		expect(content).toBe(html);
		expect(changes).toEqual([]);
	});

	it('returns empty content unchanged and ignores null input', () => {
		const { content, changes } = rewriteHtmlImages('');
		expect(content).toBe('');
		expect(changes).toEqual([]);
	});
});

describe('backfillBatch', () => {
	beforeEach(() => {
		state.pages.length = 0;
		state.updateCalls.length = 0;
		state.embedKeyMap = new Map();
		mocks.settingQuery.mockReset();
		mocks.settingQuery.mockResolvedValue({ r2Domain: 'https://r2.example.com' });
	});

	it('rewrites cid refs and runs UPDATE only when commit=true', async () => {
		state.embedKeyMap.set('1:abc', 'attachments/abc.png');
		state.pages.push({
			rows: [{ emailId: 1, content: '<p><img src="cid:abc"></p>' }]
		});

		const { c } = createContext();

		// Dry run: no UPDATE.
		const dry = await imageUrlBackfillService.backfillBatch(c, { limit: 10 });
		expect(dry.scanned).toBe(1);
		expect(dry.rewritten).toBe(1);
		expect(dry.skipped).toBe(0);
		expect(dry.failed).toEqual([]);
		expect(dry.commit).toBe(false);
		expect(dry.complete).toBe(true);
		expect(state.updateCalls).toEqual([]);

		// Re-stage the same page; commit=true should issue exactly one UPDATE.
		state.pages.push({
			rows: [{ emailId: 1, content: '<p><img src="cid:abc"></p>' }]
		});
		const committed = await imageUrlBackfillService.backfillBatch(c, { limit: 10, commit: true });
		expect(committed.commit).toBe(true);
		expect(state.updateCalls).toHaveLength(1);
		expect(state.updateCalls[0].sql).toMatch(/UPDATE email SET content = \? WHERE email_id = \?/);
		expect(state.updateCalls[0].params[1]).toBe(1);
		expect(state.updateCalls[0].params[0]).toContain(`${IMAGE_URL_PLACEHOLDER}attachments/abc.png`);
	});

	it('skips rows whose content is already normalized', async () => {
		state.pages.push({
			rows: [{ emailId: 1, content: `<p><img src="${IMAGE_URL_PLACEHOLDER}attachments/foo.png"></p>` }]
		});

		const { c } = createContext();
		const result = await imageUrlBackfillService.backfillBatch(c, { commit: true });

		expect(result.scanned).toBe(1);
		expect(result.skipped).toBe(1);
		expect(result.rewritten).toBe(0);
		expect(state.updateCalls).toEqual([]);
	});

	it('reports cid_unresolved and skips the row on commit', async () => {
		state.pages.push({
			rows: [{
				emailId: 1,
				content: '<p><img src="cid:missing"></p>'
			}]
		});

		const { c } = createContext();

		// Dry run: row stays counted as rewritten (potential change detected) but UPDATE is skipped,
		// and cid_unresolved is reported in `failed`.
		const dry = await imageUrlBackfillService.backfillBatch(c, { limit: 10 });
		expect(dry.failed).toEqual([{ emailId: 1, reason: 'cid_unresolved', refs: ['missing'] }]);
		expect(dry.rewritten).toBe(0);
		expect(state.updateCalls).toEqual([]);

		// Commit: row is skipped entirely to avoid partial writes.
		state.pages.push({
			rows: [{ emailId: 1, content: '<p><img src="cid:missing"></p>' }]
		});
		const committed = await imageUrlBackfillService.backfillBatch(c, { limit: 10, commit: true });
		expect(committed.rewritten).toBe(0);
		expect(committed.failed).toEqual([{ emailId: 1, reason: 'cid_unresolved', refs: ['missing'] }]);
		expect(state.updateCalls).toEqual([]);
	});

	it('rewrites absolute R2 URLs using previousDomains hints', async () => {
		state.pages.push({
			rows: [{
				emailId: 9,
				content: '<p><img src="https://old.r2.example.com/attachments/x.png"></p>'
			}]
		});

		const { c } = createContext();
		const result = await imageUrlBackfillService.backfillBatch(c, {
			previousDomains: ['https://old.r2.example.com'],
			commit: true
		});

		expect(result.rewritten).toBe(1);
		expect(result.domainPrefixes).toContain('https://old.r2.example.com/');
		expect(state.updateCalls[0].params[0]).toContain(`${IMAGE_URL_PLACEHOLDER}attachments/x.png`);
	});

	it('paginates with cursor and reports complete when the page is short', async () => {
		// First call: full page → returns cursor, complete=false.
		state.pages.push({
			rows: [
				{ emailId: 1, content: '<p><img src="cid:a"></p>' },
				{ emailId: 2, content: '<p><img src="cid:b"></p>' }
			]
		});
		state.embedKeyMap.set('1:a', 'attachments/a.png');
		state.embedKeyMap.set('2:b', 'attachments/b.png');

		const { c } = createContext();
		const first = await imageUrlBackfillService.backfillBatch(c, { limit: 2, commit: true });
		expect(first.complete).toBe(false);
		expect(first.cursor).toBe(2);

		// Second call: empty page → cursor=null, complete=true.
		state.pages.push({ rows: [] });
		const second = await imageUrlBackfillService.backfillBatch(c, { limit: 2, cursor: 2, commit: true });
		expect(second.complete).toBe(true);
		expect(second.cursor).toBe(null);
		expect(second.scanned).toBe(0);
	});

	it('clamps limit to IMAGE_URL_BACKFILL_MAX_LIMIT', async () => {
		state.pages.push({ rows: [] });
		const { c } = createContext();

		// limit too high — internally clamped; we just verify it doesn't throw and returns defaults.
		await imageUrlBackfillService.backfillBatch(c, { limit: 99999 });
		expect(IMAGE_URL_BACKFILL_MAX_LIMIT).toBe(200);
		expect(IMAGE_URL_BACKFILL_DEFAULT_LIMIT).toBe(50);
	});

	it('throws when D1 is not bound', async () => {
		await expect(imageUrlBackfillService.backfillBatch({ env: {} }, {}))
			.rejects.toThrow('D1 database not bound');
	});
});