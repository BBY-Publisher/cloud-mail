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

function logBrevoSync(stage, details = {}, level = 'info') {
	const logger = level === 'error'
		? console.error
		: level === 'warn'
			? console.warn
			: console.info;
	logger('[brevo-sync]', {
		stage,
		...details
	});
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
			logBrevoSync('email-list.request', {
				messageId: normalizedMessageId,
				limit: 100
			});
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
			logBrevoSync('email-list.response', {
				messageId: normalizedMessageId,
				resultCount: list.length,
				matchingCount: matchingIdRows.length,
				uuid: listItem?.uuid || null
			});

			if (!listItem?.uuid) {
				throw new BizError('Brevo 邮件 UUID 为空');
			}

			logBrevoSync('email-detail.request', {
				messageId: normalizedMessageId,
				uuid: listItem.uuid
			});
			const response = await client.transactionalEmails.getTransacEmailContent({ uuid: listItem.uuid });
			logBrevoSync('email-detail.response', {
				messageId: normalizedMessageId,
				uuid: listItem.uuid,
				hasData: Boolean(response?.data),
				eventCount: Array.isArray(response?.data?.events) ? response.data.events.length : 0,
				hasBody: Boolean(response?.data?.body)
			});
			if (!response?.data) {
				throw new BizError('Brevo 邮件详情为空');
			}
			return {
				listItem,
				content: response.data
			};
		} catch (e) {
			logBrevoSync('email-retrieve.error', {
				messageId: normalizeProviderEmailId('brevo', messageId),
				error: e?.body?.message || e?.message || 'unknown error'
			}, 'error');
			if (e?.body?.message) {
				throw new BizError(`Brevo 反查邮件详情失败: ${e.body.message}`);
			}
			throw new BizError(`Brevo 反查邮件详情失败: ${e?.message || 'unknown error'}`);
		}
	},

	async syncFromProvider(c) {
		const apiKey = c.env.brevo_api_key;

		if (!apiKey) {
			logBrevoSync('sync.unconfigured', {}, 'warn');
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
		const updated = 0;
		let skipped = 0;
		const errors = [];
		const limit = 5000;
		const days = 30;
		const seenMessageIds = new Set();
		let offset = 0;
		let pages = 0;
		let totalEvents = 0;
		let hasMore = true;

		logBrevoSync('sync.start', { days, limit });

		while (hasMore && pages < 50) {
			pages++;
			const pageStats = {
				invalid: 0,
				duplicate: 0,
				existing: 0,
				missing: 0,
				inserted: 0,
				errors: 0
			};

			let response;
			try {
				logBrevoSync('events.request', {
					page: pages,
					days,
					limit,
					offset
				});
				response = await client.transactionalEmails.getEmailEventReport({
					days,
					limit,
					offset,
					sort: 'desc'
				});
			} catch (e) {
				const error = e?.body?.message || e?.message || 'list failed';
				errors.push(`brevo[events]: ${error}`);
				logBrevoSync('events.error', {
					page: pages,
					offset,
					error
				}, 'error');
				hasMore = false;
				break;
			}

			const events = Array.isArray(response?.data?.events) ? response.data.events : [];
			totalEvents += events.length;
			logBrevoSync('events.response', {
				page: pages,
				offset,
				eventCount: events.length,
				hasData: Boolean(response?.data),
				eventsIsArray: Array.isArray(response?.data?.events)
			});

			for (const event of events) {
				const providerEmailId = normalizeProviderEmailId('brevo', event?.messageId);

				if (!providerEmailId) {
					errors.push('brevo[events][unknown]: message ID is empty');
					pageStats.invalid++;
					continue;
				}
				if (seenMessageIds.has(providerEmailId)) {
					pageStats.duplicate++;
					continue;
				}
				seenMessageIds.add(providerEmailId);

				try {
					const existing = await emailService.selectByProviderEmailId(c, 'brevo', providerEmailId);
					if (existing) {
						skipped++;
						pageStats.existing++;
						continue;
					}

					pageStats.missing++;
					logBrevoSync('message.missing', {
						messageId: providerEmailId,
						event: normalizeBrevoEventName(event?.event)
					});
					const detail = await this.retrieveEmail(
						c,
						providerEmailId,
						event.email,
						client
					);
					const emailRow = await this.toEmailRow(c, {
						...event,
						'message-id': event.messageId
					}, detail);

					const insertedEmail = await emailService.insertFromProvider(
						c,
						'brevo',
						providerEmailId,
						emailRow
					);
					inserted++;
					pageStats.inserted++;
					logBrevoSync('message.inserted', {
						messageId: providerEmailId,
						emailId: insertedEmail?.emailId || null
					});
				} catch (e) {
					const error = e?.message || String(e);
					errors.push(`brevo[${providerEmailId}]: ${error}`);
					pageStats.errors++;
					logBrevoSync('message.error', {
						messageId: providerEmailId,
						error
					}, 'error');
				}
			}

			logBrevoSync('page.complete', {
				page: pages,
				offset,
				eventCount: events.length,
				...pageStats
			});
			offset += events.length;
			hasMore = events.length === limit;
		}

		if (hasMore) {
			errors.push('brevo[events]: pagination page limit reached');
			logBrevoSync('pagination.limit', {
				pages,
				offset,
				limit
			}, 'error');
		}

		logBrevoSync('sync.complete', {
			pages,
			totalEvents,
			uniqueMessageIds: seenMessageIds.size,
			inserted,
			updated,
			skipped,
			errorCount: errors.length
		});
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
