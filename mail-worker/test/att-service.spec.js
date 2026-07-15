import { describe, expect, it } from 'vitest';
import {
	ATTACHMENT_INSERT_BATCH_SIZE,
	insertAttachmentRows
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
