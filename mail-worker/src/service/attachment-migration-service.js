import attService from './att-service';
import BizError from '../error/biz-error';
import { attConst } from '../const/entity-const';

export const ATTACHMENT_MIGRATION_PREFIX = 'attachments/';
export const ATTACHMENT_MIGRATION_DEFAULT_LIMIT = 20;
export const ATTACHMENT_MIGRATION_MAX_LIMIT = 100;

const MIME_TYPES = {
	avif: 'image/avif',
	bmp: 'image/bmp',
	csv: 'text/csv',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	gif: 'image/gif',
	html: 'text/html',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	json: 'application/json',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	pdf: 'application/pdf',
	png: 'image/png',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	svg: 'image/svg+xml',
	txt: 'text/plain',
	webp: 'image/webp',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xml: 'application/xml',
	zip: 'application/zip'
};

function getFilenameFromKey(key) {
	const filename = String(key || '').split('/').pop();
	return filename || 'attachment';
}

function inferContentType(key) {
	const filename = getFilenameFromKey(key);
	const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
	return MIME_TYPES[extension] || 'application/octet-stream';
}

function encodeFilename(filename) {
	return encodeURIComponent(filename).replace(/[!'()*]/g, char =>
		`%${char.charCodeAt(0).toString(16).toUpperCase()}`
	);
}

export function buildAttachmentHttpMetadata(key, kvMetadata, attachmentRow) {
	const metadata = kvMetadata && typeof kvMetadata === 'object' ? kvMetadata : {};
	const row = attachmentRow || {};
	const filename = row.filename || getFilenameFromKey(key);
	const dispositionType = row.type === attConst.type.EMBED || row.contentId ? 'inline' : 'attachment';

	const httpMetadata = {
		contentType: metadata.contentType || row.mimeType || inferContentType(key),
		contentDisposition: metadata.contentDisposition
			|| `${dispositionType}; filename*=UTF-8''${encodeFilename(filename)}`
	};

	if (metadata.cacheControl) {
		httpMetadata.cacheControl = metadata.cacheControl;
	}

	if (metadata.contentEncoding) {
		httpMetadata.contentEncoding = metadata.contentEncoding;
	}

	if (metadata.contentLanguage) {
		httpMetadata.contentLanguage = metadata.contentLanguage;
	}

	return httpMetadata;
}

function normalizeLimit(value) {
	const limit = Number(value);
	if (!Number.isInteger(limit) || limit < 1) {
		return ATTACHMENT_MIGRATION_DEFAULT_LIMIT;
	}
	return Math.min(limit, ATTACHMENT_MIGRATION_MAX_LIMIT);
}

const attachmentMigrationService = {
	async migrateBatch(c, params = {}) {
		if (!c.env.kv) {
			throw new BizError('KV database not bound', 502);
		}

		if (!c.env.r2) {
			throw new BizError('R2 bucket not bound', 502);
		}

		const limit = normalizeLimit(params.limit);
		const listOptions = {
			prefix: ATTACHMENT_MIGRATION_PREFIX,
			limit
		};
		if (params.cursor) {
			listOptions.cursor = params.cursor;
		}

		const page = await c.env.kv.list(listOptions);
		const keys = page.keys.map(item => item.name);
		let attachmentRows = [];

		if (keys.length > 0) {
			try {
				attachmentRows = await attService.selectOneByKeys(c, keys);
			} catch (error) {
				console.warn('Unable to load attachment metadata from D1 during KV migration:', error);
			}
		}

		const attachmentByKey = new Map(attachmentRows.map(row => [row.key, row]));
		let migrated = 0;
		let skipped = 0;
		const failed = [];

		for (const key of keys) {
			try {
				const object = await c.env.kv.getWithMetadata(key, { type: 'arrayBuffer' });
				if (!object.value) {
					skipped += 1;
					continue;
				}

				const httpMetadata = buildAttachmentHttpMetadata(
					key,
					object.metadata,
					attachmentByKey.get(key)
				);

				await c.env.r2.put(key, object.value, { httpMetadata });
				migrated += 1;
			} catch (error) {
				failed.push({
					key,
					message: error instanceof Error ? error.message : String(error)
				});
			}
		}

		const hasFailures = failed.length > 0;
		return {
			migrated,
			skipped,
			failed,
			cursor: hasFailures ? (params.cursor || null) : (page.list_complete ? null : page.cursor),
			complete: !hasFailures && page.list_complete
		};
	}
};

export default attachmentMigrationService;
