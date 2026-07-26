import { describe, expect, it } from 'vitest';
import {
	ATTACHMENT_INSERT_BATCH_SIZE,
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
