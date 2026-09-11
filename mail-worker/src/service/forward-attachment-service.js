import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import orm from '../entity/orm';
import { att } from '../entity/att';
import email from '../entity/email';
import { attConst, isDel } from '../const/entity-const';
import { isUploadedAttachmentKey, MAX_ATTACHMENT_UPLOAD_SIZE } from '../const/attachment-const';
import BizError from '../error/biz-error';
import accountMemberService from './account-member-service';
import r2Service from './r2-service';
import domainUtils from '../utils/domain-uitls';
import fileUtils from '../utils/file-utils';
import { isUploadedR2Attachment, safeDownloadUrl } from '../utils/attachment-email-utils';

function checkSize(size) {
	if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ATTACHMENT_UPLOAD_SIZE) {
		throw new BizError('Forwarded attachment is empty or exceeds 64 MiB', 413);
	}
}

function localKey(value, c, r2Domain) {
	const url = safeDownloadUrl(value);
	if (!url) {
		if (!String(value).startsWith('attachments/') || String(value).includes('..')) {
			throw new BizError('Invalid source attachment key', 400);
		}
		return value;
	}
	const source = new URL(url);
	const origin = new URL(c.req.url).origin;
	const storageBase = r2Domain ? new URL(domainUtils.toOssDomain(r2Domain) + '/') : null;
	let key;
	if (source.origin === origin && source.pathname.startsWith('/api/oss/attachments/')) {
		key = source.pathname.slice('/api/oss/'.length);
	} else if (source.origin === origin && source.pathname.startsWith('/attachments/')) {
		key = source.pathname.slice(1);
	} else if (storageBase && source.origin === storageBase.origin
		&& source.pathname.startsWith(storageBase.pathname + 'attachments/')) {
		key = source.pathname.slice(storageBase.pathname.length);
	} else {
		return null;
	}
	return decodeURIComponent(key);
}

async function store(c, attachment, content, key) {
	checkSize(content.byteLength);
	const extension = String(attachment.filename || '').match(/\.[a-z0-9]{1,16}$/i)?.[0].toLowerCase() || '';
	const targetKey = isUploadedAttachmentKey(key) ? key : `attachments/${uuidv4()}${extension}`;
	const filename = attachment.filename || 'attachment';
	const contentType = attachment.mimeType || attachment.contentType || 'application/octet-stream';
	await c.env.r2.put(targetKey, content, {
		httpMetadata: {
			contentType,
			contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
		},
		customMetadata: { filename: encodeURIComponent(filename) }
	});
	return { storageType: 'R2', key: targetKey, filename, contentType, size: content.byteLength,
		url: `${new URL(c.req.url).origin}/api/oss/${targetKey}` };
}

const forwardAttachmentService = {
	async resolve(c, attachments, userId, { isAdmin = false, r2Domain } = {}) {
		const resolved = [];
		for (const attachment of attachments) {
			if (attachment.storageType !== 'existing') {
				if (isUploadedR2Attachment(attachment) || attachment.storageType === 'external') {
					resolved.push(attachment);
					continue;
				}
				if (!c.env.r2) throw new BizError('R2 attachment storage is not enabled', 409);
				const content = fileUtils.base64ToUint8Array(fileUtils.base64ToDataStr(attachment.content));
				resolved.push(await store(c, attachment, content));
				continue;
			}

			if (!Number.isSafeInteger(attachment.attId) || attachment.attId <= 0) {
				throw new BizError('Invalid source attachment ID', 400);
			}
			const record = await orm(c).select({ attachment: att, source: email }).from(att)
				.innerJoin(email, eq(att.emailId, email.emailId))
				.where(and(eq(att.attId, attachment.attId), eq(att.type, attConst.type.ATT))).get();
			if (!record || record.attachment.contentId) {
				throw new BizError('Source attachment is unavailable', 404);
			}
			if (!isAdmin && (record.source.isDel !== isDel.NORMAL
				|| !await accountMemberService.can(c, record.source.accountId, userId, 'read'))) {
				throw new BizError('Source attachment is not accessible', 403);
			}

			const row = record.attachment;
			const key = localKey(row.key, c, r2Domain);
			if (key === null) {
				resolved.push({ storageType: 'external', url: safeDownloadUrl(row.key),
					filename: row.filename || 'attachment', contentType: row.mimeType, size: row.size || 0 });
				continue;
			}
			if (!c.env.r2) throw new BizError('R2 attachment storage is not enabled', 409);

			// Reuse current uploads; legacy keys are copied into the upload namespace.
			const existing = await c.env.r2.get(key);
			if (existing) {
				checkSize(existing.size);
				if (isUploadedAttachmentKey(key)) {
					resolved.push({ storageType: 'R2', key, filename: row.filename || 'attachment',
						contentType: row.mimeType, size: existing.size,
						url: `${new URL(c.req.url).origin}/api/oss/${key}` });
					continue;
				}
			}
			let content = existing ? await existing.arrayBuffer() : null;
			if (!content && c.env.kv) {
				content = (await c.env.kv.getWithMetadata(key, { type: 'arrayBuffer' })).value;
			}
			if (!content && await r2Service.storageType(c) === 'S3') {
				const object = await r2Service.getObj(c, key);
				content = object ? await object.arrayBuffer() : null;
			}
			if (!content) throw new BizError('Source attachment file is missing', 404);
			resolved.push(await store(c, row, content, key));
		}
		return resolved;
	}
};

export default forwardAttachmentService;
