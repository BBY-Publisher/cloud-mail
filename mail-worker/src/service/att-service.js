import orm from '../entity/orm';
import { att } from '../entity/att';
import { and, eq, isNull, inArray, desc } from 'drizzle-orm';
import r2Service from './r2-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { attConst } from '../const/entity-const';
import { parseHTML } from 'linkedom';
import { v4 as uuidv4 } from 'uuid';
import domainUtils from '../utils/domain-uitls';
import settingService from "./setting-service";
import { isUploadedAttachmentKey } from '../const/attachment-const';
import { isExternalAttachment, isReferencedAttachment, safeDownloadUrl } from '../utils/attachment-email-utils';

export const ATTACHMENT_INSERT_BATCH_SIZE = 5;

// 内嵌图片上限：富引用的回复邮件常常超过 10 张，这里统一为 50。
// 上限校验在 email-service.send() 中、email 行写入之前完成。
export const MAX_INLINE_IMAGES = 50;

export function isUploadedAttachmentUrl(src) {
	try {
		const url = new URL(String(src || ''), 'https://cloud-mail.invalid');
		return url.pathname.startsWith('/api/oss/attachments/');
	} catch (_) {
		return false;
	}
}

export async function insertAttachmentRows(c, rows) {
	for (let index = 0; index < rows.length; index += ATTACHMENT_INSERT_BATCH_SIZE) {
		const batch = rows.slice(index, index + ATTACHMENT_INSERT_BATCH_SIZE);
		await orm(c).insert(att).values(batch).run();
	}
}

export async function toStoredAttachment(attachment, userId, accountId, emailId) {
	const mimeType = attachment.contentType
		|| attachment.mimeType
		|| (typeof attachment.type === 'string' ? attachment.type : null)
		|| 'application/octet-stream';

	if ((attachment.storageType === 'R2' && attachment.key)
		|| isExternalAttachment(attachment) || isReferencedAttachment(attachment)) {
		if (attachment.storageType === 'R2' && !isUploadedAttachmentKey(attachment.key)) {
			throw new Error('Invalid uploaded attachment key');
		}

		return {
			row: {
				userId,
				accountId,
				emailId,
				key: isExternalAttachment(attachment) ? safeDownloadUrl(attachment.url) : attachment.key,
				size: Number(attachment.size) || 0,
				filename: attachment.filename,
				mimeType,
				type: attConst.type.ATT
			},
			upload: null
		};
	}

	const buff = fileUtils.base64ToUint8Array(attachment.content);
	const key = constant.ATTACHMENT_PREFIX
		+ await fileUtils.getBuffHash(buff)
		+ fileUtils.getExtFileName(attachment.filename);

	return {
		row: {
			userId,
			accountId,
			emailId,
			key,
			size: buff.length,
			filename: attachment.filename,
			mimeType,
			type: attConst.type.ATT
		},
		upload: {
			key,
			content: buff,
			contentType: mimeType,
			filename: attachment.filename
		}
	};
}

const attService = {

	async addAtt(c, attachments) {

		for (let attachment of attachments) {

			let metadate = {
				contentType: attachment.mimeType,
			}

			if (!attachment.contentId) {
				metadate.contentDisposition = `attachment;filename=${attachment.filename}`
			} else {
				metadate.contentDisposition = `inline;filename=${attachment.filename}`
				metadate.cacheControl = `max-age=259200`
			}

			await r2Service.putObj(c, attachment.key, attachment.content, metadate);

		}

		await insertAttachmentRows(c, attachments);
	},

	list(c, params, userId) {
		const { emailId } = params;

		return orm(c).select().from(att).where(
			and(
				eq(att.emailId, emailId),
				eq(att.userId, userId),
				eq(att.type, attConst.type.ATT),
				isNull(att.contentId)
			)
		).all();
	},

	async toImageUrlHtml(c, content) {

		const { r2Domain } = await settingService.query(c);

		const { document } = parseHTML(content);

		const images = Array.from(document.querySelectorAll('img'));

		let imageDataList = [];

		// 同源去重：相同的 R2 key / 相同的 data:image 内容只生成一个 cid，
		// 所有引用它的 <img> 都改写为同一个 cid:。这样 provider 只会收到一份
		// 内嵌图片，DB 的 EMBED 行也只插入一次。
		const r2CidByKey = new Map();
		const dataCidByHash = new Map();

		for (const img of images) {

			const rawSrc = img.getAttribute('src');
			const src = (rawSrc || '').trim();
			const uploadedAttachmentUrl = isUploadedAttachmentUrl(src);

			//邮件正文base64图片转cid附件
			if (src && src.startsWith('data:image')) {
				const file = fileUtils.base64ToFile(src);
				const buff = await file.arrayBuffer();
				const hash = await fileUtils.getBuffHash(buff);
				let cid = dataCidByHash.get(hash);
				if (!cid) {
					cid = uuidv4().replace(/-/g, '');
					dataCidByHash.set(hash, cid);
					const key = constant.ATTACHMENT_PREFIX + hash + fileUtils.getExtFileName(file.name);

					const attData = {};
					attData.key = key;
					attData.filename = file.name;
					attData.mimeType = file.type;
					attData.size = file.size;
					attData.buff = buff;
					attData.content = fileUtils.base64ToDataStr(src);
					attData.contentId = cid;

					imageDataList.push(attData);
				}
				img.setAttribute('src', 'cid:' + cid);
			} else if (src && !uploadedAttachmentUrl
				&& (src.startsWith(domainUtils.toOssDomain(r2Domain)) || src.startsWith('attachments/'))) {

				// 去除 query / fragment，保证 ?v=2 这类缓存破坏参数不会破坏去重。
				const bareSrc = src.split('?')[0].split('#')[0];
				const r2DomainPrefix = domainUtils.toOssDomain(r2Domain) + '/';
				const key = bareSrc.startsWith(r2DomainPrefix)
					? bareSrc.replace(r2DomainPrefix, '')
					: bareSrc;

				let cid = r2CidByKey.get(key);
				if (!cid) {
					cid = uuidv4().replace(/-/g, '');
					r2CidByKey.set(key, cid);

					const attData = {};
					attData.key = key;
					attData.contentId = cid;
					attData.type = attConst.type.EMBED;
					imageDataList.push(attData);
				}
				img.setAttribute('src', 'cid:' + cid);

			}

			const hasInlineWidth = img.hasAttribute('width');
			const style = img.getAttribute('style') || '';
			const hasStyleWidth = /(^|\s)width\s*:\s*[^;]+/.test(style);

			if (!hasInlineWidth && !hasStyleWidth) {
				const newStyle = (style ? style.trim().replace(/;$/, '') + '; ' : '') + 'max-width: 100%;';
				img.setAttribute('style', newStyle);
			}
		}

		//查询已有内嵌url图片信息
		const keys = [...new Set(imageDataList.filter(item => !item.content).map(item => item.key))];
		const dbImageList  = await this.selectOneByKeys(c, keys);

		//设置给当前附件
		await Promise.all(imageDataList.map(async image => {
			if (image.content) {
				return;
			}

			const dbImage = dbImageList.find(dbImage => image.key === dbImage.key);
			if (!dbImage) {
				return;
			}

			image.size = dbImage.size;
			image.filename = dbImage.filename;
			image.mimeType = dbImage.mimeType;
			image.contentType = dbImage.mimeType;

			const obj = await r2Service.getObj(c, image.key);
			if (!obj) {
				return;
			}

			image.content = obj instanceof ArrayBuffer ? obj : await obj.arrayBuffer();
		}))

		imageDataList = imageDataList.filter(image => image.content);

		return { imageDataList, html: document.toString() };
	},

	async saveSendAtt(c, attList, userId, accountId, emailId) {

		const attDataList = [];
		const uploads = [];

		for (let att of attList) {
			const stored = await toStoredAttachment(att, userId, accountId, emailId);
			attDataList.push(stored.row);
			if (stored.upload) {
				uploads.push(stored.upload);
			}
		}

		await insertAttachmentRows(c, attDataList);

		for (let upload of uploads) {
			await r2Service.putObj(c, upload.key, upload.content, {
				contentType: upload.contentType,
				contentDisposition: `attachment;filename=${upload.filename}`
			});
		}

	},

	async saveArticleAtt(c, attDataList, userId, accountId, emailId) {

		for (let attData of attDataList) {
			attData.userId = userId;
			attData.emailId = emailId;
			attData.accountId = accountId;
			attData.type = attConst.type.EMBED;
			if (!attData.buff) {
				continue;
			}
			await r2Service.putObj(c, attData.key, attData.buff, {
				contentType: attData.mimeType,
				cacheControl: `max-age=259200`,
				contentDisposition: `inline;filename=${attData.filename}`
			});
			delete attData.buff;
		}

		await insertAttachmentRows(c, attDataList);

	},

	async removeByUserIds(c, userIds) {
		await this.removeAttByField(c, 'user_id', userIds);
	},

	async removeByEmailIds(c, emailIds) {
		await this.removeAttByField(c, 'email_id', emailIds);
	},

	selectByEmailIds(c, emailIds) {
		return orm(c).select().from(att).where(
			and(
				inArray(att.emailId, emailIds),
				eq(att.type, attConst.type.ATT)
			))
			.all();
	},

	async removeAttByField(c, fieldName, fieldValues) {

		const sqlList = [];

		fieldValues.forEach(value => {

			sqlList.push(

				c.env.db.prepare(
					`SELECT a.key, a.att_id
						FROM attachments a
							   JOIN (SELECT key
									 FROM attachments
									 GROUP BY key
									 HAVING COUNT (*) = 1) t
									ON a.key = t.key
						WHERE a.${fieldName} = ?;`
					).bind(value)
			)

			sqlList.push(c.env.db.prepare(`DELETE FROM attachments WHERE ${fieldName} = ?`).bind(value))

		});

		const attListResult = await c.env.db.batch(sqlList);

		const delKeyList = attListResult.flatMap(r => r.results ? r.results.map(row => row.key) : []);

		if (delKeyList.length > 0) {
			await this.batchDelete(c, delKeyList);
		}

	},

	async batchDelete(c, keys) {
		if (!keys.length) return;

		const BATCH_SIZE = 1000;

		for (let i = 0; i < keys.length; i += BATCH_SIZE) {
			const batch = keys.slice(i, i + BATCH_SIZE);
			await r2Service.delete(c, batch);
		}

	},

	async removeByAccountId(c, accountId) {
		await this.removeAttByField(c, "account_id", [accountId])
	},

	selectOneByKeys(c, keys) {
		if (!keys || keys.length === 0) {
			return []
		}
		return orm(c).select().from(att).where(inArray(att.key, keys)).orderBy(desc(att.attId)).groupBy(att.key).all();
	}
};

export default attService;
