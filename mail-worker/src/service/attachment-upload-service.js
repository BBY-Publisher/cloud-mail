import { v4 as uuidv4 } from 'uuid';
import BizError from '../error/biz-error';
import {
	MAX_ATTACHMENT_UPLOAD_SIZE,
	isUploadedAttachmentKey
} from '../const/attachment-const';

export { MAX_ATTACHMENT_UPLOAD_SIZE };

function decodeFilename(value) {
	try {
		return decodeURIComponent(String(value || ''));
	} catch (_) {
		return '';
	}
}

function normalizeFilename(value) {
	return decodeFilename(value)
		.replace(/[\r\n]/g, '')
		.replace(/[\\/]/g, '_')
		.trim()
		.slice(0, 255);
}

function fileExtension(filename) {
	const match = filename.match(/\.([a-zA-Z0-9]{1,16})$/);
	return match ? `.${match[1].toLowerCase()}` : '';
}

function contentDisposition(filename, disposition = 'attachment') {
	const safeDisposition = disposition === 'inline' ? 'inline' : 'attachment';
	const asciiFilename = filename
		.normalize('NFKD')
		.replace(/[^\x20-\x7E]/g, '_')
		.replace(/["\\]/g, '_');

	return `${safeDisposition}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function validateAttachmentUpload({ size, filename, body }) {
	const numericSize = Number(size);
	const normalizedFilename = normalizeFilename(filename);

	if (!Number.isSafeInteger(numericSize) || numericSize <= 0) {
		throw new BizError('File size is required', 400);
	}
	if (numericSize > MAX_ATTACHMENT_UPLOAD_SIZE) {
		throw new BizError('A single file cannot exceed 64 MiB', 413);
	}
	if (!normalizedFilename) {
		throw new BizError('File name is required', 400);
	}
	if (!body) {
		throw new BizError('File body is required', 400);
	}

	return {
		size: numericSize,
		filename: normalizedFilename
	};
}

export const attachmentUploadService = {
	async validateReferences(c, attachments = []) {
		if (attachments.length === 0) {
			return [];
		}
		if (!c.env.r2) {
			throw new BizError('R2 attachment upload is not enabled', 409);
		}

		const validated = [];
		for (const attachment of attachments) {
			if (!isUploadedAttachmentKey(attachment.key)) {
				throw new BizError('Invalid uploaded attachment key', 400);
			}

			const obj = await c.env.r2.head(attachment.key);
			if (!obj || !Number.isSafeInteger(obj.size) || obj.size <= 0
				|| obj.size > MAX_ATTACHMENT_UPLOAD_SIZE) {
				throw new BizError('Uploaded attachment is missing or invalid', 400);
			}

			validated.push({
				storageType: 'R2',
				key: attachment.key,
				filename: normalizeFilename(obj.customMetadata?.filename || attachment.filename),
				contentType: obj.httpMetadata?.contentType
					|| attachment.contentType
					|| 'application/octet-stream',
				size: obj.size
			});
		}

		return validated;
	},

	async upload(c) {
		if (!c.env.r2) {
			throw new BizError('R2 attachment upload is not enabled', 409);
		}

		const { size, filename } = validateAttachmentUpload({
			size: c.req.header('content-length') || c.req.header('x-file-size'),
			filename: c.req.header('x-file-name'),
			body: c.req.raw.body
		});
		const contentType = String(c.req.header('content-type') || 'application/octet-stream')
			.split(';')[0]
			.trim() || 'application/octet-stream';
		const disposition = c.req.header('x-file-disposition');
		const key = `attachments/${uuidv4()}${fileExtension(filename)}`;

		const storedObject = await c.env.r2.put(key, c.req.raw.body, {
			httpMetadata: {
				contentType,
				contentDisposition: contentDisposition(filename, disposition),
				cacheControl: 'private, max-age=86400'
			},
			customMetadata: {
				filename
			}
		});
		const storedSize = Number(storedObject?.size);
		if (Number.isSafeInteger(storedSize) && storedSize > MAX_ATTACHMENT_UPLOAD_SIZE) {
			await c.env.r2.delete(key);
			throw new BizError('A single file cannot exceed 64 MiB', 413);
		}
		const actualSize = Number.isSafeInteger(storedSize) && storedSize > 0
			? storedSize
			: size;

		return {
			storageType: 'R2',
			key,
			url: `${new URL(c.req.url).origin}/api/oss/${key}`,
			filename,
			contentType,
			size: actualSize
		};
	}
};

export default attachmentUploadService;
