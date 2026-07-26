import { describe, expect, it } from 'vitest';
import {
	appendUploadedAttachmentLinks,
	appendUploadedAttachmentTextLinks,
	findInvalidAttachment,
	normalizeUploadedAttachmentUrls,
	partitionEmailAttachments
} from '../src/utils/attachment-email-utils';
import { MAX_ATTACHMENT_UPLOAD_SIZE } from '../src/service/attachment-upload-service';

const uploadedAttachment = {
	storageType: 'R2',
	key: 'attachments/report.pdf',
	url: 'https://mail.example.com/api/oss/attachments/report.pdf',
	filename: 'Quarterly <Report>.pdf',
	contentType: 'application/pdf',
	size: 1024
};

describe('partitionEmailAttachments', () => {
	it('keeps uploaded R2 files out of provider MIME attachments', () => {
		const legacy = { filename: 'legacy.txt', content: 'dGVzdA==' };

		expect(partitionEmailAttachments([uploadedAttachment, legacy])).toEqual({
			uploaded: [uploadedAttachment],
			provider: [legacy]
		});
	});

	it('rebuilds R2 download URLs from the trusted Worker origin and object key', () => {
		expect(normalizeUploadedAttachmentUrls([{
			...uploadedAttachment,
			url: 'https://attacker.example/phishing'
		}], 'https://mail.example.com')).toEqual([{
			...uploadedAttachment,
			url: 'https://mail.example.com/api/oss/attachments/report.pdf'
		}]);
	});
});

describe('appendUploadedAttachmentLinks', () => {
	it('adds a safe download list to the end of the HTML message', () => {
		const result = appendUploadedAttachmentLinks('<p>Hello</p>', [uploadedAttachment]);

		expect(result).toContain('<p>Hello</p>');
		expect(result).toContain('data-cloud-mail-attachments="true"');
		expect(result).toContain('Quarterly &lt;Report&gt;.pdf');
		expect(result).toContain('href="https://mail.example.com/api/oss/attachments/report.pdf"');
		expect(result).toContain('1 KB');
	});

	it('does not add an empty attachment section', () => {
		expect(appendUploadedAttachmentLinks('<p>Hello</p>', [])).toBe('<p>Hello</p>');
	});

	it('rejects non-http download URLs from generated HTML', () => {
		const unsafe = { ...uploadedAttachment, url: 'javascript:alert(1)' };
		const result = appendUploadedAttachmentLinks('<p>Hello</p>', [unsafe]);

		expect(result).not.toContain('javascript:');
		expect(result).not.toContain('data-cloud-mail-attachments');
	});
});

describe('appendUploadedAttachmentTextLinks', () => {
	it('adds download URLs for plain text clients', () => {
		const result = appendUploadedAttachmentTextLinks('Hello', [uploadedAttachment]);

		expect(result).toContain('Hello');
		expect(result).toContain('Quarterly <Report>.pdf');
		expect(result).toContain(uploadedAttachment.url);
	});
});

describe('findInvalidAttachment', () => {
	it('accepts uploaded and legacy attachments at the 64 MiB boundary', () => {
		expect(findInvalidAttachment([
			{ ...uploadedAttachment, size: MAX_ATTACHMENT_UPLOAD_SIZE }
		])).toBeNull();

		expect(findInvalidAttachment([{
			filename: 'legacy.bin',
			size: 6,
			content: 'QUJDREVG'
		}], 6)).toBeNull();
	});

	it('rejects uploaded metadata and legacy Base64 content over 64 MiB', () => {
		expect(findInvalidAttachment([
			{ ...uploadedAttachment, size: MAX_ATTACHMENT_UPLOAD_SIZE + 1 }
		])?.filename).toBe(uploadedAttachment.filename);

		expect(findInvalidAttachment([{
			filename: 'oversized.bin',
			size: 1,
			content: 'QUJDREVG'
		}], 5)?.filename).toBe('oversized.bin');
	});

	it('rejects malformed attachment records', () => {
		expect(findInvalidAttachment([{ filename: 'missing.bin' }])?.filename).toBe('missing.bin');
	});
});
