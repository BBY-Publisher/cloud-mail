import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import settingService from './setting-service';
import accountService from './account-service';
import emailUtils from '../utils/email-utils';
import webhookEventService from './webhook-event-service';
import providerWebhookStateService from './provider-webhook-state-service';
import { Resend } from 'resend';
import {
	buildResendEventKey,
	getProviderEventTime,
	getProviderStatusRank,
	normalizeProviderEmailId
} from '../utils/provider-webhook-utils';

const statusEventMap = {
	'email.sent': emailConst.status.SENT,
	'email.delivered': emailConst.status.DELIVERED,
	'email.opened': emailConst.status.DELIVERED,
	'email.clicked': emailConst.status.DELIVERED,
	'email.complained': emailConst.status.COMPLAINED,
	'email.bounced': emailConst.status.BOUNCED,
	'email.delivery_delayed': emailConst.status.DELAYED,
	'email.failed': emailConst.status.FAILED,
	'email.suppressed': emailConst.status.FAILED
};

const resendLastEventMap = {
	sent: emailConst.status.SENT,
	queued: emailConst.status.SAVING,
	scheduled: emailConst.status.SAVING,
	delivered: emailConst.status.DELIVERED,
	opened: emailConst.status.DELIVERED,
	clicked: emailConst.status.DELIVERED,
	complained: emailConst.status.COMPLAINED,
	bounced: emailConst.status.BOUNCED,
	delivery_delayed: emailConst.status.DELAYED,
	failed: emailConst.status.FAILED,
	suppressed: emailConst.status.FAILED,
	canceled: emailConst.status.FAILED
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

export function buildResendStatusParams(body) {
	const providerEmailId = normalizeProviderEmailId('resend', body?.data?.email_id);
	const params = {
		provider: 'resend',
		providerEmailId,
		resendEmailId: providerEmailId,
		status: statusEventMap[body.type],
		eventTime: getProviderEventTime('resend', body)
	};
	params.statusRank = getProviderStatusRank(params.status);

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
		const providerEmailId = normalizeProviderEmailId('resend', body?.data?.email_id);

		if (!providerEmailId || !body.type?.startsWith('email.')) {
			return;
		}

		const eventKey = await buildResendEventKey(body, params.headers?.id);
		const deliveryClaim = await providerWebhookStateService.claimDelivery(c, {
			provider: 'resend',
			eventKey,
			eventTime: getProviderEventTime('resend', body)
		});

		if (deliveryClaim.duplicate) return;
		if (!deliveryClaim.acquired) {
			throw new BizError('Resend webhook is already being processed', 503);
		}

		try {
			let emailRow = await emailService.selectByProviderEmailId(c, 'resend', providerEmailId);

			if (!emailRow) {
				const missingClaim = await providerWebhookStateService.claimMissingEmail(c, {
					provider: 'resend',
					providerEmailId
				});

				if (missingClaim.emailId) {
					emailRow = await emailService.selectByProviderEmailId(c, 'resend', providerEmailId);
				} else if (!missingClaim.acquired) {
					throw new BizError('Resend email backfill is already being processed', 503);
				} else {
					try {
						emailRow = await this.saveMissingEmail(c, body, providerEmailId);
					} finally {
						await providerWebhookStateService.releaseMissingEmailClaim(c, missingClaim);
					}
				}
			}

			const statusParams = buildResendStatusParams(body);

			try {
				const recipient = Array.isArray(body.data?.to)
					? body.data.to.join(', ')
					: (body.data?.to || null);

				await webhookEventService.record(c, {
					provider: 'resend',
					eventType: body.type,
					resendEmailId: providerEmailId,
					messageId: body.data?.message_id || null,
					status: statusParams.status,
					emailId: emailRow?.emailId || null,
					recipient,
					reason: statusParams.message || null,
					payload: body
				});
			} catch (e) {
				console.error('webhook event record failed (resend):', e?.message || e);
			}

			if (statusParams.status !== undefined) {
				await emailService.updateProviderEmailStatus(c, {
					...statusParams,
					emailId: emailRow.emailId
				});
			}

			await providerWebhookStateService.completeDelivery(c, deliveryClaim);
		} catch (e) {
			await providerWebhookStateService.failDelivery(c, deliveryClaim, e);
			if (e instanceof BizError && e.code === 503) throw e;
			throw new BizError(`Resend webhook processing failed: ${e?.message || e}`, 503);
		}
	},

	async verifyWebhook(c, params) {
		const { payload, headers } = params;
		const webhookSecret = c.env.resend_webhook_secret;

		if (!webhookSecret) {
			throw new BizError('Resend webhook is disabled: RESEND_WEBHOOK_SECRET is not configured', 503);
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

	async saveMissingEmail(c, body, providerEmailId) {
		const detail = await this.retrieveEmail(c, body);
		const emailRow = await this.toEmailRow(c, body, detail);
		return emailService.insertFromProvider(c, 'resend', providerEmailId, emailRow);
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

	async syncFromProvider(c) {
		const { resendTokens = {} } = await settingService.query(c);
		const tokens = Object.entries(resendTokens).filter(([, token]) => token);

		let inserted = 0;
		let updated = 0;
		let skipped = 0;
		const errors = [];

		if (tokens.length === 0) {
			return { configured: false, inserted, updated, skipped, errors };
		}

		for (const [domain, token] of tokens) {
			try {
				const resend = new Resend(token);
				const syncCollection = async ({ received, listPage, getDetail }) => {
					let after;
					let hasMore = true;
					let pages = 0;

					while (hasMore && pages < 50) {
						pages++;
						const listResult = await listPage({ limit: 100, after });

						if (listResult.error) {
							errors.push(`resend[${domain}][${received ? 'received' : 'sent'}]: ${listResult.error.message || 'list failed'}`);
							break;
						}

						const items = listResult.data?.data || [];
						hasMore = !!listResult.data?.has_more;

						for (const item of items) {
							if (!item?.id) continue;

							try {
								const existing = await emailService.selectByProviderEmailId(c, 'resend', item.id);
								if (existing) {
									if (received) {
										skipped++;
										continue;
									}

									const status = resendLastEventMap[item.last_event];
									if (status === undefined || existing.status === status) {
										skipped++;
										continue;
									}

									const changed = await emailService.updateProviderEmailStatus(c, {
										provider: 'resend',
										providerEmailId: item.id,
										resendEmailId: item.id,
										emailId: existing.emailId,
										status,
										statusRank: getProviderStatusRank(status),
										eventTime: Date.now()
									});
									if (changed) {
										updated++;
									} else {
										skipped++;
									}
									continue;
								}

								const detailResult = await getDetail(item.id);
								if (detailResult.error || !detailResult.data) {
									errors.push(`resend[${domain}][${item.id}]: ${detailResult.error?.message || 'detail failed'}`);
									continue;
								}

								const emailRow = await this.toEmailRow(c, {
									type: received ? 'email.received' : 'email.sent',
									data: {
										email_id: item.id,
										from: item.from,
										to: item.to,
										subject: item.subject,
										created_at: item.created_at
									}
								}, detailResult.data);

								await emailService.insertFromProvider(c, 'resend', item.id, emailRow);
								inserted++;
							} catch (e) {
								errors.push(`resend[${domain}][${item.id}]: ${e?.message || e}`);
							}
						}

						if (hasMore) {
							const nextAfter = items.at(-1)?.id;
							if (!nextAfter || nextAfter === after) {
								errors.push(`resend[${domain}][${received ? 'received' : 'sent'}]: pagination cursor did not advance`);
								hasMore = false;
								break;
							}
							after = nextAfter;
						}
					}

					if (hasMore) {
						errors.push(`resend[${domain}][${received ? 'received' : 'sent'}]: pagination page limit reached`);
					}
				};

				await syncCollection({
					received: false,
					listPage: options => resend.emails.list(options),
					getDetail: id => resend.emails.get(id)
				});
				await syncCollection({
					received: true,
					listPage: options => resend.emails.receiving.list(options),
					getDetail: id => resend.emails.receiving.get(id)
				});
			} catch (e) {
				errors.push(`resend[${domain}]: ${e?.message || e}`);
			}
		}

		return { configured: true, inserted, updated, skipped, errors };
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
			: resendLastEventMap[detail.last_event] ?? statusEventMap[body.type] ?? emailConst.status.SENT;

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
				message: buildResendStatusParams(body).message || null,
				provider: 'resend',
				createTime: detail.created_at || body.data.created_at || body.created_at
			};
	}
}

export default resendService
