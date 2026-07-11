import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import accountService from './account-service';
import emailUtils from '../utils/email-utils';
import webhookEventService from './webhook-event-service';
import { BrevoClient } from '@getbrevo/brevo';

const statusEventMap = {
	request: emailConst.status.SENT,
	delivered: emailConst.status.DELIVERED,
	hardBounce: emailConst.status.BOUNCED,
	softBounce: emailConst.status.BOUNCED,
	spam: emailConst.status.COMPLAINED,
	invalid_email: emailConst.status.BOUNCED,
	blocked: emailConst.status.FAILED,
	deferred: emailConst.status.DELAYED,
	unsubscribed: emailConst.status.COMPLAINED
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
	const event = body.event;
	const reason = body.reason || body.subject || '';

	const params = {
		resendEmailId: body.messageId,
		status: statusEventMap[event]
	};

	if (event === 'hardBounce' || event === 'softBounce' || event === 'invalid_email' || event === 'blocked' || event === 'deferred' || event === 'spam' || event === 'unsubscribed') {
		params.message = reason || JSON.stringify({ event, reason: body.reason });
	}

	return params;
}

async function hmacSha256Hex(secret, payload) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return Array.from(new Uint8Array(sig))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

function constantTimeEquals(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string') return false;
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

const brevoService = {

	async webhooks(c, params) {
		const { rawPayload, body, signature } = params;

		await this.verifyWebhook(c, { rawPayload, signature, url: c.req.url });

		const messageId = body?.messageId;

		if (!messageId) {
			return;
		}

		let emailRow = await emailService.selectByResendEmailId(c, messageId);

		if (!emailRow) {
			emailRow = await this.saveMissingEmail(c, body, messageId);
		}

		const statusParams = buildStatusParams(body);

		try {
			await webhookEventService.record(c, {
				provider: 'brevo',
				eventType: body.event,
				resendEmailId: messageId,
				messageId: body.messageId || null,
				status: statusParams.status,
				emailId: emailRow?.emailId || null,
				recipient: body.email || null,
				reason: statusParams.message || null,
				payload: body
			});
		} catch (e) {
			console.error('webhook event record failed (brevo):', e?.message || e);
		}

		if (statusParams.status !== undefined) {
			await emailService.updateEmailStatus(c, statusParams);
		}

	},

	async verifyWebhook(c, params) {
		const { rawPayload, signature, url } = params;
		const secret = c.env.brevo_webhook_secret;

		if (!secret) {
			throw new BizError('Brevo webhook is disabled: BREVO_WEBHOOK_SECRET is not configured', 503);
		}

		if (signature) {
			const expected = await hmacSha256Hex(secret, rawPayload);
			if (!constantTimeEquals(expected, signature)) {
				throw new BizError('Invalid Brevo webhook signature', 400);
			}
			return;
		}

		try {
			const querySecret = new URL(url).searchParams.get('secret');
			if (querySecret && querySecret === secret) {
				return;
			}
		} catch (e) {
			// ignore url parse error
		}

		throw new BizError('Brevo webhook signature missing or invalid', 400);
	},

	async saveMissingEmail(c, body, messageId) {
		const detail = await this.retrieveEmail(c, messageId);
		const emailRow = await this.toEmailRow(c, body, detail);
		return emailService.insertFromResend(c, emailRow);
	},

	async retrieveEmail(c, messageId) {
		const apiKey = c.env.brevo_api_key;

		if (!apiKey) {
			throw new BizError('BREVO_API_KEY 未配置', 500);
		}

		const client = new BrevoClient({ apiKey });

		try {
			const response = await client.transactionalEmails.getTransacEmailContent({ uuid: messageId });
			if (!response?.data) {
				throw new BizError('Brevo 邮件详情为空');
			}
			return response.data;
		} catch (e) {
			if (e?.body?.message) {
				throw new BizError(`Brevo 反查邮件详情失败: ${e.body.message}`);
			}
			throw new BizError(`Brevo 反查邮件详情失败: ${e?.message || 'unknown error'}`);
		}
	},

	async toEmailRow(c, body, detail) {
		const from = parseAddress(detail.from || body.from || '');
		const recipients = normalizeAddressList(detail.to || [{ email: body.email, name: '' }]);
		const accountEmail = recipients[0]?.address || body.email || '';
		const accountRow = accountEmail ? await accountService.selectByEmailIncludeDel(c, accountEmail) : null;
		const status = statusEventMap[body.event] || emailConst.status.SENT;

		return {
			resendEmailId: detail.id || body.messageId,
			messageId: detail.messageId || body.messageId,
			sendEmail: from.address,
			name: from.name,
			subject: detail.subject || body.subject || '',
			content: detail.htmlContent || detail.html || '',
			text: detail.textContent || detail.text || emailUtils.htmlToText(detail.htmlContent || detail.html || ''),
			accountId: accountRow?.accountId || 0,
			userId: accountRow?.userId || 0,
			status,
			type: emailConst.type.SEND,
			recipient: JSON.stringify(recipients),
			toEmail: recipients[0]?.address || body.email || '',
			toName: recipients[0]?.name || '',
			cc: JSON.stringify(normalizeAddressList(detail.cc || [])),
			bcc: JSON.stringify(normalizeAddressList(detail.bcc || [])),
			message: buildStatusParams(body).message || null,
			provider: 'brevo',
			createTime: detail.date || body.date || body.created_at
		};
	}
};

export default brevoService;