import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import settingService from './setting-service';
import accountService from './account-service';
import emailUtils from '../utils/email-utils';
import { Resend } from 'resend';

const statusEventMap = {
	'email.sent': emailConst.status.SENT,
	'email.delivered': emailConst.status.DELIVERED,
	'email.complained': emailConst.status.COMPLAINED,
	'email.bounced': emailConst.status.BOUNCED,
	'email.delivery_delayed': emailConst.status.DELAYED,
	'email.failed': emailConst.status.FAILED,
	'email.suppressed': emailConst.status.FAILED
};

const resendLastEventMap = {
	sent: emailConst.status.SENT,
	delivered: emailConst.status.DELIVERED,
	complained: emailConst.status.COMPLAINED,
	bounced: emailConst.status.BOUNCED,
	delivery_delayed: emailConst.status.DELAYED,
	failed: emailConst.status.FAILED,
	suppressed: emailConst.status.FAILED
};

function parseAddress(value) {
	if (!value || typeof value !== 'string') {
		return { name: '', address: '' };
	}

	const match = value.match(/^(.*)<([^>]+)>$/);

	if (!match) {
		const address = value.trim();
		return { name: emailUtils.getName(address), address };
	}

	const name = match[1].trim().replace(/^["']|["']$/g, '');
	const address = match[2].trim();
	return { name: name || emailUtils.getName(address), address };
}

function normalizeAddressList(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map(item => {
			if (typeof item === 'string') {
				return parseAddress(item);
			}
			return {
				name: item?.name || emailUtils.getName(item?.email || item?.address || ''),
				address: item?.email || item?.address || ''
			};
		})
		.filter(item => item.address);
}

function buildStatusParams(body) {
	const params = {
		resendEmailId: body.data.email_id,
		status: statusEventMap[body.type]
	};

	if (body.type === 'email.bounced') {
		params.message = JSON.stringify(body.data.bounce || {});
	}

	if (body.type === 'email.failed') {
		params.message = body.data.failed?.reason || JSON.stringify(body.data.failed || {});
	}

	if (body.type === 'email.suppressed') {
		params.message = JSON.stringify(body.data.suppressed || body.data);
	}

	return params;
}

const resendService = {

	async webhooks(c, params) {
		const body = await this.verifyWebhook(c, params);
		const resendEmailId = body?.data?.email_id;

		if (!resendEmailId || !body.type?.startsWith('email.')) {
			return;
		}

		let emailRow = await emailService.selectByResendEmailId(c, resendEmailId);

		if (!emailRow) {
			emailRow = await this.saveMissingEmail(c, body);
		}

		const statusParams = buildStatusParams(body);

		if (statusParams.status !== undefined) {
			await emailService.updateEmailStatus(c, statusParams);
		}

	},

	async verifyWebhook(c, params) {
		const { payload, headers } = params;
		const webhookSecret = c.env.resend_webhook_secret;

		if (!webhookSecret) {
			throw new BizError('RESEND_WEBHOOK_SECRET 未配置', 500);
		}

		try {
			const resend = new Resend('re_webhook');
			return await resend.webhooks.verify({
				payload,
				headers,
				webhookSecret
			});
		} catch (e) {
			throw new BizError('Invalid Resend webhook signature', 400);
		}
	},

	async saveMissingEmail(c, body) {
		const detail = await this.retrieveEmail(c, body);
		const emailRow = await this.toEmailRow(c, body, detail);
		return emailService.insertFromResend(c, emailRow);
	},

	async retrieveEmail(c, body) {
		const token = await this.getResendToken(c, body);
		const resend = new Resend(token);

		const result = body.type === 'email.received'
			? await resend.emails.receiving.get(body.data.email_id)
			: await resend.emails.get(body.data.email_id);

		if (result.error) {
			throw new BizError(result.error.message || '获取 Resend 邮件详情失败');
		}

		if (!result.data) {
			throw new BizError('Resend 邮件详情为空');
		}

		return result.data;
	},

	async getResendToken(c, body) {
		const { resendTokens = {} } = await settingService.query(c);
		const from = parseAddress(body.data?.from || '');
		const toList = normalizeAddressList(body.data?.to || []);
		const domains = [
			emailUtils.getDomain(from.address),
			...toList.map(item => emailUtils.getDomain(item.address))
		].filter(Boolean);

		for (const domain of domains) {
			if (resendTokens[domain]) {
				return resendTokens[domain];
			}
		}

		const fallbackToken = Object.values(resendTokens).find(Boolean);

		if (fallbackToken) {
			return fallbackToken;
		}

		throw new BizError('Resend API Token 未配置');
	},

	async toEmailRow(c, body, detail) {
		const from = parseAddress(detail.from || body.data.from || '');
		const recipients = normalizeAddressList(detail.received_for || detail.to || body.data.to || []);
		const accountEmail = body.type === 'email.received' ? recipients[0]?.address : from.address;
		const accountRow = accountEmail ? await accountService.selectByEmailIncludeDel(c, accountEmail) : null;
		const status = body.type === 'email.received'
			? accountRow ? emailConst.status.RECEIVE : emailConst.status.NOONE
			: statusEventMap[body.type] || resendLastEventMap[detail.last_event] || emailConst.status.SENT;

		return {
			resendEmailId: detail.id || body.data.email_id,
			messageId: detail.message_id || body.data.message_id,
			sendEmail: from.address,
			name: from.name,
			subject: detail.subject || body.data.subject || '',
			content: detail.html || '',
			text: detail.text || emailUtils.htmlToText(detail.html || ''),
			accountId: accountRow?.accountId || 0,
			userId: accountRow?.userId || 0,
			status,
			type: body.type === 'email.received' ? emailConst.type.RECEIVE : emailConst.type.SEND,
			recipient: JSON.stringify(recipients),
			toEmail: recipients[0]?.address || '',
			toName: recipients[0]?.name || '',
			cc: JSON.stringify(normalizeAddressList(detail.cc || [])),
			bcc: JSON.stringify(normalizeAddressList(detail.bcc || [])),
			message: buildStatusParams(body).message || null,
			createTime: detail.created_at || body.data.created_at || body.created_at
		};
	}
}

export default resendService
