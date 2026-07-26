import { describe, expect, it, vi } from 'vitest';
import {
	MAX_ATTACHMENT_UPLOAD_SIZE,
	attachmentUploadService
} from '../src/service/attachment-upload-service';

function createContext() {
	return {
		c: {
			env: {
				r2: {}
			},
			req: {
				url: 'https://mail.example.com/api/email/attachment/presign'
			}
		}
	};
}

describe('attachmentUploadService.validateReferences', () => {
	it('validates uploaded references against R2 before an email is sent', async () => {
		const { c } = createContext();
		c.env.r2.head = vi.fn(async key => key.includes('11111111')
			? {
				size: 2048,
				httpMetadata: { contentType: 'application/pdf' },
				customMetadata: { filename: encodeURIComponent('可信 报告.pdf') }
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
			filename: '可信 报告.pdf',
			contentType: 'application/pdf',
			size: 2048
		}]);

		await expect(attachmentUploadService.validateReferences(c, [{
			storageType: 'R2',
			key: 'attachments/22222222-2222-4222-8222-222222222222.pdf'
		}])).rejects.toMatchObject({ code: 400 });

		c.env.r2.head = vi.fn(async () => ({
			size: MAX_ATTACHMENT_UPLOAD_SIZE + 1
		}));
		await expect(attachmentUploadService.validateReferences(c, [{
			storageType: 'R2',
			key: 'attachments/33333333-3333-4333-8333-333333333333.bin'
		}])).rejects.toMatchObject({ code: 400 });
	});
});

describe('attachmentUploadService.createPresignedUpload', () => {
	const directUploadSetting = {
		bucket: 'cloud-mail',
		endpoint: 'https://account-id.r2.cloudflarestorage.com',
		region: 'auto',
		s3AccessKey: 'access-key',
		s3SecretKey: 'secret-key',
		forcePathStyle: 1
	};

	it('creates a short-lived, size-bound R2 PUT URL without receiving the file body', async () => {
		const { c } = createContext();
		c.req.url = 'https://mail.example.com/api/email/attachment/presign';
		const sign = vi.fn(async () => 'https://r2.example.com/signed-put');

		const result = await attachmentUploadService.createPresignedUpload(c, {
			filename: '季度 报告.pdf',
			contentType: 'application/pdf',
			disposition: 'attachment',
			size: MAX_ATTACHMENT_UPLOAD_SIZE
		}, {
			setting: directUploadSetting,
			sign
		});

		expect(sign).toHaveBeenCalledTimes(1);
		const [request] = sign.mock.calls[0];
		expect(request).toMatchObject({
			method: 'PUT',
			bucket: 'cloud-mail',
			endpoint: 'https://account-id.r2.cloudflarestorage.com',
			region: 'auto',
			expiresIn: 300,
			headers: {
				'content-length': String(MAX_ATTACHMENT_UPLOAD_SIZE),
				'content-type': 'application/pdf',
				'x-amz-meta-filename': encodeURIComponent('季度 报告.pdf')
			},
			credentials: {
				accessKeyId: 'access-key',
				secretAccessKey: 'secret-key'
			}
		});
		expect(request.key).toMatch(/^attachments\/[0-9a-f-]+\.pdf$/);
		expect(result).toEqual({
			storageType: 'R2',
			key: request.key,
			url: `https://mail.example.com/api/oss/${request.key}`,
			uploadUrl: 'https://r2.example.com/signed-put',
			uploadHeaders: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': expect.stringContaining("filename*=UTF-8''"),
				'x-amz-meta-filename': encodeURIComponent('季度 报告.pdf')
			},
			filename: '季度 报告.pdf',
			contentType: 'application/pdf',
			size: MAX_ATTACHMENT_UPLOAD_SIZE
		});
	});

	it('rejects missing R2 S3 credentials and oversized metadata before signing', async () => {
		const { c } = createContext();
		const sign = vi.fn();

		await expect(attachmentUploadService.createPresignedUpload(c, {
			filename: 'report.pdf',
			contentType: 'application/pdf',
			size: 100
		}, {
			setting: { ...directUploadSetting, s3SecretKey: '' },
			sign
		})).rejects.toMatchObject({ code: 409 });

		await expect(attachmentUploadService.createPresignedUpload(c, {
			filename: 'report.pdf',
			contentType: 'application/pdf',
			size: MAX_ATTACHMENT_UPLOAD_SIZE + 1
		}, {
			setting: directUploadSetting,
			sign
		})).rejects.toMatchObject({ code: 413 });

		expect(sign).not.toHaveBeenCalled();
	});
});
