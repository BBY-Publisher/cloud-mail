import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	settingQuery: vi.fn(async () => ({ r2Domain: 'https://r2.example.com' })),
	getObj: vi.fn(async () => null),
	selectOneByKeys: vi.fn(async () => [])
}));

vi.mock('../src/service/setting-service', () => ({
	default: { query: mocks.settingQuery }
}));

vi.mock('../src/service/r2-service', () => ({
	default: { getObj: mocks.getObj }
}));

import attService, {
	ATTACHMENT_INSERT_BATCH_SIZE,
	MAX_INLINE_IMAGES,
	insertAttachmentRows,
	isUploadedAttachmentUrl,
	toStoredAttachment
} from '../src/service/att-service';

function createD1Context() {
	const statements = [];
	const db = {
		prepare(sql) {
			return {
				bind(...params) {
					statements.push({ sql, params });
					return {
						run: async () => ({ success: true })
					};
				}
			};
		}
	};

	return {
		c: { env: { db, orm_log: false } },
		statements
	};
}

function createInlineAttachment(index) {
	return {
		userId: 1,
		emailId: 2,
		accountId: 3,
		key: `attachments/image-${index}.png`,
		filename: `image-${index}.png`,
		mimeType: 'image/png',
		size: 100,
		disposition: 'inline',
		related: true,
		contentId: `image-${index}`
	};
}

describe('insertAttachmentRows', () => {
	it('writes no more than five attachment rows per D1 statement', async () => {
		const { c, statements } = createD1Context();
		const attachments = Array.from({ length: 12 }, (_, index) => createInlineAttachment(index));

		await insertAttachmentRows(c, attachments);

		expect(ATTACHMENT_INSERT_BATCH_SIZE).toBe(5);
		expect(statements).toHaveLength(3);
		expect(statements.map(statement => statement.params.length)).toEqual([60, 60, 24]);
		expect(statements.every(statement => statement.params.length <= 100)).toBe(true);
	});

	it('does not prepare a statement for an empty attachment list', async () => {
		const { c, statements } = createD1Context();

		await insertAttachmentRows(c, []);

		expect(statements).toEqual([]);
	});
});

describe('toStoredAttachment', () => {
	it('reuses an uploaded R2 object without requiring base64 content', async () => {
		expect(await toStoredAttachment({
			storageType: 'R2',
			key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
			url: 'https://mail.example.com/api/oss/attachments/11111111-1111-4111-8111-111111111111.pdf',
			filename: 'report.pdf',
			contentType: 'application/pdf',
			size: 1234
		}, 1, 2, 3)).toEqual({
			row: {
				userId: 1,
				accountId: 2,
				emailId: 3,
				key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
				size: 1234,
				filename: 'report.pdf',
				mimeType: 'application/pdf',
				type: 0
			},
			upload: null
		});
	});

	it('keeps legacy base64 attachments on the existing upload path', async () => {
		const result = await toStoredAttachment({
			filename: 'legacy.txt',
			contentType: 'text/plain',
			content: 'dGVzdA=='
		}, 1, 2, 3);

		expect(result.row).toMatchObject({
			userId: 1,
			accountId: 2,
			emailId: 3,
			filename: 'legacy.txt',
			mimeType: 'text/plain',
			size: 4,
			type: 0
		});
		expect(result.row.key).toMatch(/^attachments\/[0-9a-f]+\.txt$/);
		expect(result.upload).toMatchObject({
			key: result.row.key,
			contentType: 'text/plain',
			filename: 'legacy.txt'
		});
	});

	it('rejects forged R2 keys outside the upload key format', async () => {
		await expect(toStoredAttachment({
			storageType: 'R2',
			key: 'attachments/report.pdf',
			filename: 'report.pdf',
			contentType: 'application/pdf',
			size: 1234
		}, 1, 2, 3)).rejects.toThrow('Invalid uploaded attachment key');
	});
});

describe('isUploadedAttachmentUrl', () => {
	it('keeps newly uploaded R2 images as remote URLs in the email body', () => {
		expect(isUploadedAttachmentUrl(
			'https://mail.example.com/api/oss/attachments/image.png'
		)).toBe(true);
		expect(isUploadedAttachmentUrl(
			'/api/oss/attachments/image.png'
		)).toBe(true);
		expect(isUploadedAttachmentUrl('attachments/image.png')).toBe(false);
	});
});

describe('MAX_INLINE_IMAGES', () => {
	it('matches the documented inline-image cap', () => {
		expect(MAX_INLINE_IMAGES).toBe(50);
	});
});

// 1x1 transparent PNG, base64-encoded.
const TINY_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function buildHtml(sources) {
	return sources.map(src => `<p><img src="${src}" /></p>`).join('');
}

function extractCids(html) {
	const matches = html.match(/cid:([a-f0-9]+)/g) || [];
	return matches.map(match => match.replace('cid:', ''));
}

describe('toImageUrlHtml', () => {
	const c = { env: {} };

	function stubR2Images(keys) {
		// Return DB rows + R2 buffers for every requested key, so the
		// enrichment pass assigns `image.content` and the trailing filter
		// keeps the entries.
		vi.spyOn(attService, 'selectOneByKeys').mockResolvedValueOnce(
			keys.map(key => ({
				key,
				size: 1,
				filename: key.split('/').pop(),
				mimeType: 'image/png'
			}))
		);
		mocks.getObj.mockImplementation(async key => new TextEncoder().encode(`bytes-for-${key}`).buffer);
	}

	beforeEach(() => {
		mocks.settingQuery.mockClear();
		mocks.getObj.mockClear();
	});

	it('dedupes the same R2 URL referenced in multiple <img> tags', async () => {
		stubR2Images(['attachments/abc.png']);
		const src = 'https://r2.example.com/attachments/abc.png';
		const { imageDataList, html } = await attService.toImageUrlHtml(c, buildHtml([src, src, src]));

		expect(imageDataList).toHaveLength(1);
		expect(imageDataList[0].key).toBe('attachments/abc.png');
		const cids = extractCids(html);
		expect(cids).toHaveLength(3);
		expect(new Set(cids).size).toBe(1);
	});

	it('strips cache-buster query strings before dedup', async () => {
		stubR2Images(['attachments/abc.png']);
		const srcA = 'https://r2.example.com/attachments/abc.png';
		const srcB = 'https://r2.example.com/attachments/abc.png?v=42';
		const { imageDataList, html } = await attService.toImageUrlHtml(c, buildHtml([srcA, srcB]));

		expect(imageDataList).toHaveLength(1);
		const cids = extractCids(html);
		expect(cids).toHaveLength(2);
		expect(new Set(cids).size).toBe(1);
	});

	it('dedupes the same data:image referenced in multiple <img> tags', async () => {
		const src = `data:image/png;base64,${TINY_PNG_BASE64}`;
		const { imageDataList, html } = await attService.toImageUrlHtml(c, buildHtml([src, src]));

		expect(imageDataList).toHaveLength(1);
		expect(imageDataList[0].mimeType).toBe('image/png');
		// `content` is stored as raw base64 (no `data:` prefix); see base64ToDataStr.
		expect(imageDataList[0].content).toBe(TINY_PNG_BASE64);
		expect(imageDataList[0].buff).toBeInstanceOf(ArrayBuffer);
		const cids = extractCids(html);
		expect(cids).toHaveLength(2);
		expect(new Set(cids).size).toBe(1);
	});

	it('keeps distinct R2 images distinct', async () => {
		stubR2Images(['attachments/a.png', 'attachments/b.png']);
		const a = 'https://r2.example.com/attachments/a.png';
		const b = 'https://r2.example.com/attachments/b.png';
		const { imageDataList } = await attService.toImageUrlHtml(c, buildHtml([a, b, a]));

		expect(imageDataList).toHaveLength(2);
		const keys = imageDataList.map(item => item.key).sort();
		expect(keys).toEqual(['attachments/a.png', 'attachments/b.png']);
	});

	it('keeps R2 and data:image separate when mixed', async () => {
		stubR2Images(['attachments/foo.png']);
		const r2Src = 'https://r2.example.com/attachments/foo.png';
		const dataSrc = `data:image/png;base64,${TINY_PNG_BASE64}`;
		const { imageDataList, html } = await attService.toImageUrlHtml(c, buildHtml([r2Src, dataSrc, r2Src, dataSrc]));

		expect(imageDataList).toHaveLength(2);
		// Each unique source should produce exactly one cid reused by both tags.
		const cids = extractCids(html);
		expect(cids).toHaveLength(4);
		expect(new Set(cids).size).toBe(2);
	});
});
