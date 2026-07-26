import { describe, expect, it } from 'vitest';
import { presignR2Put } from '../src/utils/r2-presign-utils';

const baseRequest = {
	method: 'PUT',
	bucket: 'cloud-mail',
	key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
	endpoint: 'https://account-id.r2.cloudflarestorage.com',
	region: 'auto',
	expiresIn: 300,
	headers: {
		'content-disposition': 'attachment; filename="report.pdf"',
		'content-length': '1024',
		'content-type': 'application/pdf',
		'x-amz-meta-filename': 'report.pdf'
	},
	credentials: {
		accessKeyId: 'access-key',
		secretAccessKey: 'secret-key'
	},
	now: new Date('2026-07-26T03:04:05.000Z')
};

describe('presignR2Put', () => {
	it('creates a deterministic SigV4 URL scoped to one R2 object and the signed upload headers', async () => {
		const signedUrl = await presignR2Put(baseRequest);
		const url = new URL(signedUrl);

		expect(url.origin).toBe('https://cloud-mail.account-id.r2.cloudflarestorage.com');
		expect(url.pathname).toBe('/attachments/11111111-1111-4111-8111-111111111111.pdf');
		expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
		expect(url.searchParams.get('X-Amz-Content-Sha256')).toBe('UNSIGNED-PAYLOAD');
		expect(url.searchParams.get('X-Amz-Credential'))
			.toBe('access-key/20260726/auto/s3/aws4_request');
		expect(url.searchParams.get('X-Amz-Date')).toBe('20260726T030405Z');
		expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
			'content-disposition;content-length;content-type;host;x-amz-meta-filename'
		);
		expect(url.searchParams.get('X-Amz-Signature'))
			.toBe('25147fc0029e4f232083e442fb8e83a9bc0b326222b400f6d3f513cc773262b0');
		expect(signedUrl).not.toContain('secret-key');
	});

	it('binds the signature to the declared file size', async () => {
		const first = new URL(await presignR2Put(baseRequest));
		const second = new URL(await presignR2Put({
			...baseRequest,
			headers: {
				...baseRequest.headers,
				'content-length': '1025'
			}
		}));

		expect(first.searchParams.get('X-Amz-Signature'))
			.not.toBe(second.searchParams.get('X-Amz-Signature'));
	});

	it('rejects unsafe endpoints and excessive expiry windows', async () => {
		await expect(presignR2Put({
			...baseRequest,
			endpoint: 'http://account-id.r2.cloudflarestorage.com'
		})).rejects.toThrow('HTTPS');

		await expect(presignR2Put({
			...baseRequest,
			expiresIn: 604801
		})).rejects.toThrow('expiry');
	});
});
