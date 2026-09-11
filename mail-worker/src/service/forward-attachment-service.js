import { and, eq } from 'drizzle-orm';
import orm from '../entity/orm';
import { att } from '../entity/att';
import email from '../entity/email';
import { attConst, isDel } from '../const/entity-const';
import BizError from '../error/biz-error';
import accountMemberService from './account-member-service';
import domainUtils from '../utils/domain-uitls';
import { safeDownloadUrl } from '../utils/attachment-email-utils';

function downloadUrl(key, c, r2Domain) {
	const url = safeDownloadUrl(key);
	if (url) return url;
	if (!String(key).startsWith('attachments/') || String(key).includes('..')) {
		throw new BizError('Invalid source attachment key', 400);
	}
	const base = r2Domain
		? domainUtils.toOssDomain(r2Domain)
		: `${new URL(c.req.url).origin}/api/oss`;
	return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

const forwardAttachmentService = {
	async resolve(c, attachments, userId, { isAdmin = false, r2Domain } = {}) {
		const resolved = [];
		for (const attachment of attachments) {
			if (attachment.storageType !== 'existing') {
				resolved.push(attachment);
				continue;
			}

			if (!Number.isSafeInteger(attachment.attId) || attachment.attId <= 0) {
				throw new BizError('Invalid source attachment ID', 400);
			}
			const record = await orm(c).select({ attachment: att, source: email }).from(att)
				.innerJoin(email, eq(att.emailId, email.emailId))
				.where(and(eq(att.attId, attachment.attId), eq(att.type, attConst.type.ATT))).get();
			// ATT rows can have Content-ID too; the query already excludes EMBED rows.
			if (!record) {
				throw new BizError('Source attachment is unavailable', 404);
			}
			if (!isAdmin && (record.source.isDel !== isDel.NORMAL
				|| !await accountMemberService.can(c, record.source.accountId, userId, 'read'))) {
				throw new BizError('Source attachment is not accessible', 403);
			}

			const row = record.attachment;
			// Keep the original object key for shared-file cleanup and reuse its URL.
			// No object download, migration, or upload is needed to forward a reference.
			resolved.push({ storageType: 'reference', key: row.key,
				url: downloadUrl(row.key, c, r2Domain), filename: row.filename || 'attachment',
				contentType: row.mimeType, size: row.size || 0 });
		}
		return resolved;
	}
};

export default forwardAttachmentService;
