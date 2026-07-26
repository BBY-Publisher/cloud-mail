import { v4 as uuidv4 } from 'uuid';
import BizError from '../error/biz-error';
import {
	MAX_ATTACHMENT_UPLOAD_SIZE,
	isUploadedAttachmentKey
} from '../const/attachment-const';
import settingService from './setting-service';
import domainUtils from '../utils/domain-uitls';
import { settingConst } from '../const/entity-const';
import { presignR2Put } from '../utils/r2-presign-utils';

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

function validateAttachmentMetadata({ size, filename, contentType }) {
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

	const normalizedContentType = String(contentType || 'application/octet-stream')
		.split(';')[0]
		.replace(/[\r\n]/g, '')
		.trim()
		.slice(0, 255) || 'application/octet-stream';

	return {
		size: numericSize,
		filename: normalizedFilename,
		contentType: normalizedContentType
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

	async createPresignedUpload(c, params, dependencies = {}) {
		if (!c.env.r2) {
			throw new BizError('R2 attachment upload is not enabled', 409);
		}

		const { size, filename, contentType } = validateAttachmentMetadata(params || {});
		const setting = dependencies.setting || await settingService.query(c);
		const {
			bucket,
			endpoint,
			region,
			s3AccessKey,
			s3SecretKey,
			forcePathStyle
		} = setting || {};
		if (!bucket || !endpoint || !s3AccessKey || !s3SecretKey) {
			throw new BizError(
				'Direct R2 upload requires Bucket, Endpoint, Access Key and Secret Key in S3 configuration',
				409
			);
		}

		const disposition = params?.disposition === 'inline' ? 'inline' : 'attachment';
		const key = `attachments/${uuidv4()}${fileExtension(filename)}`;
		const encodedFilename = encodeURIComponent(filename);
		const dispositionHeader = contentDisposition(filename, disposition);
		const uploadHeaders = {
			'Content-Type': contentType,
			'Content-Disposition': dispositionHeader,
			'x-amz-meta-filename': encodedFilename
		};
		const sign = dependencies.sign || presignR2Put;
		const uploadUrl = await sign({
			method: 'PUT',
			bucket,
			key,
			endpoint: domainUtils.toOssDomain(endpoint),
			region: region || 'auto',
			expiresIn: 300,
			forcePathStyle: forcePathStyle === settingConst.forcePathStyle.OPEN,
			headers: {
				'content-length': String(size),
				'content-type': contentType,
				'content-disposition': dispositionHeader,
				'x-amz-meta-filename': encodedFilename
			},
			credentials: {
				accessKeyId: s3AccessKey,
				secretAccessKey: s3SecretKey
			}
		});

		return {
			storageType: 'R2',
			key,
			url: `${new URL(c.req.url).origin}/api/oss/${key}`,
			uploadUrl,
			uploadHeaders,
			filename,
			contentType,
			size
		};
	}
};

export default attachmentUploadService;
