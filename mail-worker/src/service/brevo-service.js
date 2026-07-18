import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';
import accountService from './account-service';
import emailUtils from '../utils/email-utils';
import webhookEventService from './webhook-event-service';
import providerWebhookStateService from './provider-webhook-state-service';
import settingService from './setting-service';
import { BrevoClient } from '@getbrevo/brevo';
import {
	buildBrevoEventKey,
	constantTimeEquals,
	getProviderEventTime,
	getProviderStatusRank,
	normalizeBrevoEventName,
	normalizeProviderEmailId,
	providerEmailIdCandidates,
	toBrevoApiMessageId
} from '../utils/provider-webhook-utils';

const statusEventMap = {
	request: emailConst.status.SENT,
	sent: emailConst.status.SENT,
	delivered: emailConst.status.DELIVERED,
	hard_bounce: emailConst.status.BOUNCED,
	soft_bounce: emailConst.status.BOUNCED,
	spam: emailConst.status.COMPLAINED,
	invalid_email: emailConst.status.BOUNCED,
	blocked: emailConst.status.FAILED,
	error: emailConst.status.FAILED,
	deferred: emailConst.status.DELAYED,
	click: emailConst.status.DELIVERED,
	clicked: emailConst.status.DELIVERED,
	clicks: emailConst.status.DELIVERED,
	opened: emailConst.status.DELIVERED,
	unique_opened: emailConst.status.DELIVERED,
	proxy_open: emailConst.status.DELIVERED,
	unique_proxy_open: emailConst.status.DELIVERED,
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

export function getBrevoMessageId(body) {
	return normalizeProviderEmailId('brevo', body?.['message-id'] || body?.messageId);
}

export function buildBrevoStatusParams(body) {
	const event = normalizeBrevoEventName(body?.event);
	const reason = body.reason || body.subject || '';
	const providerEmailId = getBrevoMessageId(body);

	const params = {
		provider: 'brevo',
		providerEmailId,
		resendEmailId: providerEmailId,
		status: statusEventMap[event],
		eventTime: getProviderEventTime('brevo', body)
	};
	params.statusRank = getProviderStatusRank(params.status);

	if (event === 'hard_bounce' || event === 'soft_bounce' || event === 'invalid_email' || event === 'blocked' || event === 'error' || event === 'deferred' || event === 'spam' || event === 'unsubscribed') {
		params.message = reason || JSON.stringify({ event, reason: body.reason });
	}

	return params;
}

export function buildBrevoDetailStatusParams(messageId, content, fallbackDate) {
	const events = Array.isArray(content?.events) ? content.events : [];
	const supportedEvents = events
		.map(event => {
			const name = normalizeBrevoEventName(event?.name);
			const status = statusEventMap[name];
			const eventTime = Date.parse(event?.time || '');
			return {
				name,
				status,
				eventTime: Number.isFinite(eventTime) ? eventTime : 0,
				statusRank: getProviderStatusRank(status)
			};
		})
		.filter(event => event.status !== undefined);

	supportedEvents.sort((left, right) => (
		left.eventTime - right.eventTime || left.statusRank - right.statusRank
	));

	const latest = supportedEvents.at(-1) || {
		name: 'sent',
		status: emailConst.status.SENT,
		eventTime: Date.parse(content?.date || fallbackDate || '') || 0,
		statusRank: getProviderStatusRank(emailConst.status.SENT)
	};
	const params = buildBrevoStatusParams({
		event: latest.name,
		'message-id': messageId,
		ts_event: latest.eventTime
	});
	params.event = latest.name;
	params.eventTime = latest.eventTime;
	return params;
}

const brevoService = {

	async webhooks(c, params) {
		const { body } = params;

		await this.verifyWebhook(c, { ...params, url: c.req.url });

		const providerEmailId = getBrevoMessageId(body);

		if (!providerEmailId) {
			return;
		}

		const deliveryClaim = await providerWebhookStateService.claimDelivery(c, {
			provider: 'brevo',
			eventKey: await buildBrevoEventKey(body),
			eventTime: getProviderEventTime('brevo', body)
		});
		if (deliveryClaim.duplicate) return;
		if (!deliveryClaim.acquired) {
			throw new BizError('Brevo webhook is already being processed', 429);
		}

		try {
			let emailRow = await emailService.selectByProviderEmailId(c, 'brevo', providerEmailId);

			if (!emailRow) {
				const missingClaim = await providerWebhookStateService.claimMissingEmail(c, {
					provider: 'brevo',
					providerEmailId
				});

				if (missingClaim.emailId) {
					emailRow = await emailService.selectByProviderEmailId(c, 'brevo', providerEmailId);
				} else if (!missingClaim.acquired) {
					throw new BizError('Brevo email backfill is already being processed', 429);
				} else {
					try {
						emailRow = await this.saveMissingEmail(c, body, providerEmailId);
					} finally {
						await providerWebhookStateService.releaseMissingEmailClaim(c, missingClaim);
					}
				}
			}

			const statusParams = buildBrevoStatusParams(body);

			try {
				await webhookEventService.record(c, {
					provider: 'brevo',
					eventType: body.event,
					resendEmailId: providerEmailId,
					messageId: body['message-id'] || body.messageId || null,
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
				await emailService.updateProviderEmailStatus(c, {
					...statusParams,
					emailId: emailRow.emailId
				});
			}

			await providerWebhookStateService.completeDelivery(c, deliveryClaim);
		} catch (e) {
			await providerWebhookStateService.failDelivery(c, deliveryClaim, e);
			if (e instanceof BizError && e.code === 429) throw e;
			throw new BizError(`Brevo webhook processing failed: ${e?.message || e}`, 429);
		}
	},

	async verifyWebhook(c, params) {
		const { authorization, webhookSecret, url } = params;
		const { brevoWebhookSecret: secret } = await settingService.query(c);

		if (!secret) {
			throw new BizError('Brevo webhook is disabled: webhook secret is not configured', 503);
		}

		const bearer = String(authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
		if (
			constantTimeEquals(secret, String(webhookSecret || ''))
			|| constantTimeEquals(secret, bearer)
			|| constantTimeEquals(secret, String(authorization || ''))
		) {
			return;
		}

		try {
			const querySecret = new URL(url).searchParams.get('secret');
			// Deprecated compatibility path. Prefer a custom static header or
			// Authorization because query parameters are commonly logged.
			if (querySecret && constantTimeEquals(querySecret, secret)) {
				return;
			}
		} catch (e) {
			// ignore url parse error
		}

		throw new BizError('Brevo webhook credentials missing or invalid', 400);
	},

	async saveMissingEmail(c, body, messageId) {
		const detail = await this.retrieveEmail(c, messageId, body.email);
		const emailRow = await this.toEmailRow(c, body, detail);
		return emailService.insertFromProvider(c, 'brevo', messageId, emailRow);
	},

	async retrieveEmail(c, messageId, recipient, existingClient) {
		const apiKey = c.env.brevo_api_key;

		if (!apiKey) {
			throw new BizError('BREVO_API_KEY 未配置', 500);
		}

		const client = existingClient || new BrevoClient({ apiKey });

		try {
			const normalizedMessageId = normalizeProviderEmailId('brevo', messageId);
			const listResponse = await client.transactionalEmails.getTransacEmailsList({
				messageId: toBrevoApiMessageId(normalizedMessageId),
				limit: 100,
				sort: 'desc'
			});
			const candidates = providerEmailIdCandidates('brevo', normalizedMessageId);
			const list = listResponse?.data?.transactionalEmails || [];
			const normalizedRecipient = String(recipient || '').trim().toLowerCase();
			const matchingIdRows = list.filter(item => candidates.includes(String(item?.messageId || '').trim()));
			const listItem = matchingIdRows.find(item => (
				!normalizedRecipient || String(item?.email || '').trim().toLowerCase() === normalizedRecipient
			)) || matchingIdRows[0] || list[0];

			if (!listItem?.uuid) {
				throw new BizError('Brevo 邮件 UUID 为空');
			}

			const response = await client.transactionalEmails.getTransacEmailContent({ uuid: listItem.uuid });
			if (!response?.data) {
				throw new BizError('Brevo 邮件详情为空');
			}
			return {
				listItem,
				content: response.data
			};
		} catch (e) {
			if (e?.body?.message) {
				throw new BizError(`Brevo 反查邮件详情失败: ${e.body.message}`);
			}
			throw new BizError(`Brevo 反查邮件详情失败: ${e?.message || 'unknown error'}`);
		}
	},

	async syncFromProvider(c) {
		const apiKey = c.env.brevo_api_key;

		if (!apiKey) {
			return {
				configured: false,
				inserted: 0,
				updated: 0,
				skipped: 0,
				errors: []
			};
		}

		const client = new BrevoClient({ apiKey });

		let inserted = 0;
		let updated = 0;
		let skipped = 0;
		const errors = [];
		const limit = 100;
		const messageIds = await emailService.selectProviderEmailIds(c, 'brevo');

		for (const messageId of messageIds) {
			let offset = 0;
			let pages = 0;
			let hasMore = true;

			while (hasMore && pages < 50) {
				pages++;

				let response;
				try {
					response = await client.transactionalEmails.getTransacEmailsList({
						messageId: toBrevoApiMessageId(messageId),
						limit,
						offset,
						sort: 'desc'
					});
				} catch (e) {
					errors.push(`brevo[${messageId}][emails]: ${e?.body?.message || e?.message || 'list failed'}`);
					hasMore = false;
					break;
				}

				const list = response?.data?.transactionalEmails || [];
				const total = Number(response?.data?.count);

				for (const listItem of list) {
					const providerEmailId = normalizeProviderEmailId(
						'brevo',
						listItem?.messageId || messageId
					);

					try {
						const existing = await emailService.selectByProviderEmailId(c, 'brevo', providerEmailId);

						let detail;
						try {
							if (!listItem?.uuid) {
								throw new BizError('Brevo 邮件 UUID 为空');
							}
							const detailResponse = await client.transactionalEmails.getTransacEmailContent({
								uuid: listItem.uuid
							});
							if (!detailResponse?.data) {
								throw new BizError('Brevo 邮件详情为空');
							}
							detail = {
								listItem,
								content: detailResponse.data
							};
						} catch (e) {
							errors.push(`brevo[${providerEmailId}]: ${e?.body?.message || e?.message || 'detail failed'}`);
							continue;
						}

						const statusParams = buildBrevoDetailStatusParams(
							providerEmailId,
							detail.content,
							listItem.date
						);
						if (existing) {
							if (existing.status === statusParams.status) {
								skipped++;
								continue;
							}

							const changed = await emailService.updateProviderEmailStatus(c, {
								...statusParams,
								emailId: existing.emailId
							});
							if (changed) {
								updated++;
							} else {
								skipped++;
							}
							continue;
						}

						const emailRow = await this.toEmailRow(c, {
							event: statusParams.event,
							'message-id': listItem.messageId || toBrevoApiMessageId(messageId),
							email: listItem.email,
							from: listItem.from,
							subject: listItem.subject,
							date: listItem.date
						}, detail);

						await emailService.insertFromProvider(c, 'brevo', providerEmailId, emailRow);
						inserted++;
					} catch (e) {
						errors.push(`brevo[${providerEmailId}]: ${e?.message || e}`);
					}
				}

				if (list.length === 0) {
					hasMore = false;
					break;
				}

				offset += list.length;
				hasMore = Number.isFinite(total)
					? offset < total
					: list.length === limit;
			}

			if (hasMore) {
				errors.push(`brevo[${messageId}][emails]: pagination page limit reached`);
			}
		}

		return { configured: true, inserted, updated, skipped, errors };
	},

	async toEmailRow(c, body, detail) {
		const listItem = detail?.listItem || {};
		const content = detail?.content || detail || {};
		const rawMessageId = listItem.messageId || body['message-id'] || body.messageId || '';
		const providerEmailId = normalizeProviderEmailId('brevo', rawMessageId);
		const from = parseAddress(listItem.from || body.from || '');
		const recipientEmail = content.email || listItem.email || body.email || '';
		const recipients = normalizeAddressList([{ email: recipientEmail, name: '' }]);
		const accountEmail = recipients[0]?.address || body.email || '';
		const accountRow = accountEmail ? await accountService.selectByEmailIncludeDel(c, accountEmail) : null;
		const status = statusEventMap[normalizeBrevoEventName(body.event)] || emailConst.status.SENT;
		const html = content.body || '';

		return {
			resendEmailId: providerEmailId,
			messageId: rawMessageId,
			sendEmail: from.address,
			name: from.name,
			subject: content.subject || listItem.subject || body.subject || '',
			content: html,
			text: emailUtils.htmlToText(html),
			accountId: accountRow?.accountId || 0,
			userId: accountRow?.userId || 0,
			status,
			type: emailConst.type.SEND,
			recipient: JSON.stringify(recipients),
			toEmail: recipients[0]?.address || body.email || '',
			toName: recipients[0]?.name || '',
			cc: '[]',
			bcc: '[]',
			message: buildBrevoStatusParams(body).message || null,
			provider: 'brevo',
			createTime: content.date || listItem.date || body.date || body.created_at
		};
	}
};

export default brevoService;
