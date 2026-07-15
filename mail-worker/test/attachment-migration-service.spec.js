import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	selectOneByKeys: vi.fn()
}));

vi.mock('../src/service/att-service', () => ({
	default: {
		selectOneByKeys: mocks.selectOneByKeys
	}
}));

import attachmentMigrationService, {
	ATTACHMENT_MIGRATION_DEFAULT_LIMIT,
	ATTACHMENT_MIGRATION_PREFIX,
	buildAttachmentHttpMetadata
} from '../src/service/attachment-migration-service';

function createContext({ listResult, values = new Map(), putErrorKey } = {}) {
	const kv = {
		list: vi.fn(async () => listResult || {
			keys: [],
			list_complete: true,
			cursor: ''
		}),
		getWithMetadata: vi.fn(async key => values.get(key) || { value: null, metadata: null })
	};
	const r2 = {
		put: vi.fn(async key => {
			if (key === putErrorKey) throw new Error('R2 write failed');
		})
	};

	return { c: { env: { kv, r2 } }, kv, r2 };
}

describe('buildAttachmentHttpMetadata', () => {
	it('preserves KV file metadata when it is available', () => {
		expect(buildAttachmentHttpMetadata(
			'attachments/hash.pdf',
			{
				contentType: 'application/pdf',
				contentDisposition: 'attachment;filename=invoice.pdf',
				cacheControl: 'max-age=60'
			},
			{ filename: 'ignored.pdf', mimeType: 'text/plain' }
		)).toEqual({
			contentType: 'application/pdf',
			contentDisposition: 'attachment;filename=invoice.pdf',
			cacheControl: 'max-age=60'
		});
	});

	it('uses the attachment row for the original filename and MIME type', () => {
		expect(buildAttachmentHttpMetadata(
			'attachments/hash.bin',
			null,
			{ filename: '报表 2026.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', type: 0 }
		)).toEqual({
			contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			contentDisposition: "attachment; filename*=UTF-8''%E6%8A%A5%E8%A1%A8%202026.xlsx"
		});
	});

	it('falls back to the key extension when no stored metadata exists', () => {
		expect(buildAttachmentHttpMetadata('attachments/photo.png')).toEqual({
			contentType: 'image/png',
			contentDisposition: "attachment; filename*=UTF-8''photo.png"
		});
	});

	it('preserves additional HTTP metadata supported by R2', () => {
		expect(buildAttachmentHttpMetadata('attachments/data.json', {
			contentEncoding: 'gzip',
			contentLanguage: 'zh-CN'
		})).toEqual({
			contentType: 'application/json',
			contentDisposition: "attachment; filename*=UTF-8''data.json",
			contentEncoding: 'gzip',
			contentLanguage: 'zh-CN'
		});
	});
});

describe('migrateBatch', () => {
	beforeEach(() => {
		mocks.selectOneByKeys.mockReset();
		mocks.selectOneByKeys.mockResolvedValue([]);
	});

	it('copies one KV page to R2 with the same keys, values, and HTTP metadata', async () => {
		const firstValue = new TextEncoder().encode('first').buffer;
		const secondValue = new TextEncoder().encode('second').buffer;
		const values = new Map([
			['attachments/a.pdf', { value: firstValue, metadata: { contentType: 'application/pdf', contentDisposition: 'attachment;filename=a.pdf' } }],
			['attachments/b.png', { value: secondValue, metadata: null }]
		]);
		const { c, kv, r2 } = createContext({
			listResult: {
				keys: [{ name: 'attachments/a.pdf' }, { name: 'attachments/b.png' }],
				list_complete: false,
				cursor: 'next-page'
			},
			values
		});
		mocks.selectOneByKeys.mockResolvedValue([
			{ key: 'attachments/b.png', filename: 'logo.png', mimeType: 'image/png', type: 1 }
		]);

		const result = await attachmentMigrationService.migrateBatch(c, { cursor: 'current-page', limit: 2 });

		expect(kv.list).toHaveBeenCalledWith({
			prefix: ATTACHMENT_MIGRATION_PREFIX,
			cursor: 'current-page',
			limit: 2
		});
		expect(mocks.selectOneByKeys).toHaveBeenCalledWith(c, ['attachments/a.pdf', 'attachments/b.png']);
		expect(r2.put).toHaveBeenNthCalledWith(1, 'attachments/a.pdf', firstValue, {
			httpMetadata: {
				contentType: 'application/pdf',
				contentDisposition: 'attachment;filename=a.pdf'
			}
		});
		expect(r2.put).toHaveBeenNthCalledWith(2, 'attachments/b.png', secondValue, {
			httpMetadata: {
				contentType: 'image/png',
				contentDisposition: "inline; filename*=UTF-8''logo.png"
			}
		});
		expect(result).toEqual({
			migrated: 2,
			skipped: 0,
			failed: [],
			cursor: 'next-page',
			complete: false
		});
	});

	it('skips missing KV values without writing empty R2 objects', async () => {
		const { c, r2 } = createContext({
			listResult: {
				keys: [{ name: 'attachments/missing.txt' }],
				list_complete: true,
				cursor: ''
			}
		});

		const result = await attachmentMigrationService.migrateBatch(c);

		expect(r2.put).not.toHaveBeenCalled();
		expect(result).toEqual({
			migrated: 0,
			skipped: 1,
			failed: [],
			cursor: null,
			complete: true
		});
	});

	it('returns failed keys and keeps the current cursor so the page can be retried', async () => {
		const value = new TextEncoder().encode('retry').buffer;
		const { c, kv } = createContext({
			listResult: {
				keys: [{ name: 'attachments/retry.txt' }],
				list_complete: false,
				cursor: 'next-page'
			},
			values: new Map([['attachments/retry.txt', { value, metadata: { contentType: 'text/plain' } }]]),
			putErrorKey: 'attachments/retry.txt'
		});

		const result = await attachmentMigrationService.migrateBatch(c, { cursor: 'current-page' });

		expect(kv.list).toHaveBeenCalledWith({
			prefix: ATTACHMENT_MIGRATION_PREFIX,
			cursor: 'current-page',
			limit: ATTACHMENT_MIGRATION_DEFAULT_LIMIT
		});
		expect(result).toEqual({
			migrated: 0,
			skipped: 0,
			failed: [{ key: 'attachments/retry.txt', message: 'R2 write failed' }],
			cursor: 'current-page',
			complete: false
		});
	});

	it('requires both KV and R2 bindings', async () => {
		await expect(attachmentMigrationService.migrateBatch({ env: {} }))
			.rejects.toMatchObject({ message: 'KV database not bound', code: 502 });
		await expect(attachmentMigrationService.migrateBatch({ env: { kv: {} } }))
			.rejects.toMatchObject({ message: 'R2 bucket not bound', code: 502 });
	});

	it('caps the page size and still migrates when D1 metadata lookup fails', async () => {
		const value = new TextEncoder().encode('content').buffer;
		const { c, kv, r2 } = createContext({
			listResult: {
				keys: [{ name: 'attachments/archive.zip' }],
				list_complete: true,
				cursor: ''
			},
			values: new Map([['attachments/archive.zip', { value, metadata: null }]])
		});
		mocks.selectOneByKeys.mockRejectedValue(new Error('D1 unavailable'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await attachmentMigrationService.migrateBatch(c, { limit: 1000 });

		expect(kv.list).toHaveBeenCalledWith({ prefix: ATTACHMENT_MIGRATION_PREFIX, limit: 100 });
		expect(r2.put).toHaveBeenCalledWith('attachments/archive.zip', value, {
			httpMetadata: {
				contentType: 'application/zip',
				contentDisposition: "attachment; filename*=UTF-8''archive.zip"
			}
		});
		expect(result.complete).toBe(true);
		warn.mockRestore();
	});
});
