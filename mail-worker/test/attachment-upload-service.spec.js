import { describe, expect, it, vi } from 'vitest';
import {
	MAX_ATTACHMENT_UPLOAD_SIZE,
	attachmentUploadService,
	validateAttachmentUpload
} from '../src/service/attachment-upload-service';

function createContext({
	size = 1024,
	filename = 'report.pdf',
	contentType = 'application/pdf',
	body = new ReadableStream(),
	storedObject
} = {}) {
	const put = vi.fn(async () => storedObject);
	const del = vi.fn();

	return {
		c: {
			env: {
				r2: { put, delete: del }
			},
			req: {
				url: 'https://mail.example.com/api/email/attachment/upload',
				raw: { body },
				header(name) {
					const headers = {
						'content-length': String(size),
						'x-file-name': encodeURIComponent(filename),
						'content-type': contentType
					};
					return headers[name.toLowerCase()];
				}
			}
		},
		put,
		del
	};
}

describe('validateAttachmentUpload', () => {
	it('accepts a file exactly 64 MiB', () => {
		expect(validateAttachmentUpload({
			size: MAX_ATTACHMENT_UPLOAD_SIZE,
			filename: 'archive.zip',
			body: {}
		})).toEqual({
			size: MAX_ATTACHMENT_UPLOAD_SIZE,
			filename: 'archive.zip'
		});
	});

	it('rejects a file larger than 64 MiB', () => {
		expect(() => validateAttachmentUpload({
			size: MAX_ATTACHMENT_UPLOAD_SIZE + 1,
			filename: 'archive.zip',
			body: {}
		})).toThrow('64');
	});

	it('rejects missing length, filename, or body', () => {
		expect(() => validateAttachmentUpload({ size: null, filename: 'a.txt', body: {} })).toThrow();
		expect(() => validateAttachmentUpload({ size: 1, filename: '', body: {} })).toThrow();
		expect(() => validateAttachmentUpload({ size: 1, filename: 'a.txt', body: null })).toThrow();
	});
});

describe('attachmentUploadService.upload', () => {
	it('streams the file into R2 and returns a Worker public URL', async () => {
		const body = new ReadableStream();
		const { c, put } = createContext({ body, filename: '季度 报告.pdf' });

		const result = await attachmentUploadService.upload(c);

		expect(result.storageType).toBe('R2');
		expect(result.key).toMatch(/^attachments\/[0-9a-f-]+\.pdf$/);
		expect(result.filename).toBe('季度 报告.pdf');
		expect(result.contentType).toBe('application/pdf');
		expect(result.size).toBe(1024);
		expect(result.url).toBe(`https://mail.example.com/api/oss/${result.key}`);
		expect(put).toHaveBeenCalledWith(result.key, body, {
			httpMetadata: {
				contentType: 'application/pdf',
				contentDisposition: expect.stringContaining("filename*=UTF-8''"),
				cacheControl: 'private, max-age=86400'
			},
			customMetadata: {
				filename: '季度 报告.pdf'
			}
		});
	});

	it('rejects upload when R2 is not bound', async () => {
		const { c } = createContext();
		delete c.env.r2;

		await expect(attachmentUploadService.upload(c)).rejects.toMatchObject({ code: 409 });
	});

	it('removes an object when R2 reports an actual size above 64 MiB', async () => {
		const { c, del } = createContext({
			size: 1,
			filename: 'oversized.bin',
			storedObject: { size: MAX_ATTACHMENT_UPLOAD_SIZE + 1 }
		});

		await expect(attachmentUploadService.upload(c)).rejects.toMatchObject({ code: 413 });
		expect(del).toHaveBeenCalledWith(expect.stringMatching(/^attachments\//));
	});

	it('validates uploaded references against R2 before an email is sent', async () => {
		const { c } = createContext();
		c.env.r2.head = vi.fn(async key => key.includes('11111111')
			? {
				size: 2048,
				httpMetadata: { contentType: 'application/pdf' },
				customMetadata: { filename: 'trusted.pdf' }
			}
			: null);

		await expect(attachmentUploadService.validateReferences(c, [{
			storageType: 'R2',
			key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
			filename: 'client-name.pdf',
			size: 1
		}])).resolves.toEqual([{
			storageType: 'R2',
			key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
			filename: 'trusted.pdf',
			contentType: 'application/pdf',
			size: 2048
		}]);

		await expect(attachmentUploadService.validateReferences(c, [{
			storageType: 'R2',
			key: 'attachments/22222222-2222-4222-8222-222222222222.pdf'
		}])).rejects.toMatchObject({ code: 400 });
	});
});
