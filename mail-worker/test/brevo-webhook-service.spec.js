import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailConst } from '../src/const/entity-const';

const mocks = vi.hoisted(() => ({
	getEmailEventReport: vi.fn(),
	getTransacEmailsList: vi.fn(),
	getTransacEmailContent: vi.fn(),
	selectByEmailIncludeDel: vi.fn(),
	selectByProviderEmailId: vi.fn(),
	insertFromProvider: vi.fn(),
	updateProviderEmailStatus: vi.fn(),
	claimDelivery: vi.fn(),
	completeDelivery: vi.fn(),
	failDelivery: vi.fn(),
	claimMissingEmail: vi.fn(),
	releaseMissingEmailClaim: vi.fn(),
	recordWebhookEvent: vi.fn(),
	querySetting: vi.fn()
}));

vi.mock('@getbrevo/brevo', () => ({
	BrevoClient: class {
		constructor() {
			this.transactionalEmails = {
				getEmailEventReport: mocks.getEmailEventReport,
				getTransacEmailsList: mocks.getTransacEmailsList,
				getTransacEmailContent: mocks.getTransacEmailContent
			};
		}
	}
}));

vi.mock('../src/service/account-service', () => ({
	default: {
		selectByEmailIncludeDel: mocks.selectByEmailIncludeDel
	}
}));

vi.mock('../src/service/email-service', () => ({
	default: {
		selectByProviderEmailId: mocks.selectByProviderEmailId,
		insertFromProvider: mocks.insertFromProvider,
		updateProviderEmailStatus: mocks.updateProviderEmailStatus
	}
}));

vi.mock('../src/service/provider-webhook-state-service', () => ({
	default: {
		claimDelivery: mocks.claimDelivery,
		completeDelivery: mocks.completeDelivery,
		failDelivery: mocks.failDelivery,
		claimMissingEmail: mocks.claimMissingEmail,
		releaseMissingEmailClaim: mocks.releaseMissingEmailClaim
	}
}));

vi.mock('../src/service/webhook-event-service', () => ({
	default: {
		record: mocks.recordWebhookEvent
	}
}));

vi.mock('../src/service/setting-service', () => ({
	default: {
		query: mocks.querySetting
	}
}));

import brevoService, {
	buildBrevoStatusParams,
	getBrevoMessageId
} from '../src/service/brevo-service';

let infoSpy;

describe('Brevo webhook contract', () => {
	beforeEach(() => {
		infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.getEmailEventReport.mockReset();
		mocks.getTransacEmailsList.mockReset();
		mocks.getTransacEmailContent.mockReset();
		mocks.selectByEmailIncludeDel.mockReset();
		mocks.selectByEmailIncludeDel.mockResolvedValue({
			accountId: 10,
			userId: 20
		});
		mocks.selectByProviderEmailId.mockReset();
		mocks.insertFromProvider.mockReset();
		mocks.updateProviderEmailStatus.mockReset();
		mocks.claimDelivery.mockReset();
		mocks.completeDelivery.mockReset();
		mocks.failDelivery.mockReset();
		mocks.claimMissingEmail.mockReset();
		mocks.releaseMissingEmailClaim.mockReset();
		mocks.recordWebhookEvent.mockReset();
		mocks.querySetting.mockReset();
		mocks.claimDelivery.mockResolvedValue({
			provider: 'brevo',
			eventKey: 'event-key',
			token: 'delivery-token',
			acquired: true,
			duplicate: false
		});
		mocks.completeDelivery.mockResolvedValue();
		mocks.failDelivery.mockResolvedValue();
		mocks.releaseMissingEmailClaim.mockResolvedValue();
		mocks.recordWebhookEvent.mockResolvedValue();
		mocks.querySetting.mockResolvedValue({
			brevoWebhookSecret: 'webhook-secret'
		});
		mocks.updateProviderEmailStatus.mockResolvedValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reads the official message-id field and normalizes it', () => {
		expect(getBrevoMessageId({
			'message-id': '<abc@relay.example>'
		})).toBe('abc@relay.example');
	});

	it('accepts Brevo static custom-header and bearer credentials', async () => {
		const c = { env: { brevo_webhook_secret: 'legacy-env-secret' } };

		await expect(brevoService.verifyWebhook(c, {
			webhookSecret: 'webhook-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).resolves.toBeUndefined();
		await expect(brevoService.verifyWebhook(c, {
			authorization: 'Bearer webhook-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).resolves.toBeUndefined();
		await expect(brevoService.verifyWebhook(c, {
			webhookSecret: 'wrong-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).rejects.toMatchObject({ code: 400 });
	});

	it('uses the persisted Brevo webhook secret instead of later env changes', async () => {
		mocks.querySetting.mockResolvedValue({
			brevoWebhookSecret: 'saved-secret'
		});
		const c = { env: { brevo_webhook_secret: 'changed-env-secret' } };

		await expect(brevoService.verifyWebhook(c, {
			webhookSecret: 'saved-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).resolves.toBeUndefined();
		await expect(brevoService.verifyWebhook(c, {
			webhookSecret: 'changed-env-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).rejects.toMatchObject({ code: 400 });
	});

	it('keeps the webhook disabled when the saved secret is empty', async () => {
		mocks.querySetting.mockResolvedValue({
			brevoWebhookSecret: ''
		});

		await expect(brevoService.verifyWebhook({
			env: { brevo_webhook_secret: 'legacy-env-secret' }
		}, {
			webhookSecret: 'legacy-env-secret',
			url: 'https://worker.example/webhooks/brevo'
		})).rejects.toMatchObject({ code: 503 });
	});

	it.each([
		['request', emailConst.status.SENT],
		['delivered', emailConst.status.DELIVERED],
		['soft_bounce', emailConst.status.BOUNCED],
		['hard_bounce', emailConst.status.BOUNCED],
		['invalid_email', emailConst.status.BOUNCED],
		['blocked', emailConst.status.FAILED],
		['error', emailConst.status.FAILED],
		['deferred', emailConst.status.DELAYED],
		['click', emailConst.status.DELIVERED],
		['opened', emailConst.status.DELIVERED],
		['uniqueOpened', emailConst.status.DELIVERED],
		['spam', emailConst.status.COMPLAINED],
		['unsubscribed', emailConst.status.COMPLAINED]
	])('maps official event %s to local status %s', (event, status) => {
		expect(buildBrevoStatusParams({
			event,
			'message-id': '<abc@relay.example>'
		})).toMatchObject({
			provider: 'brevo',
			providerEmailId: 'abc@relay.example',
			status
		});
	});

	it('resolves message ID to UUID before retrieving content', async () => {
		mocks.getTransacEmailsList.mockResolvedValue({
			data: {
				transactionalEmails: [{
					messageId: '<abc@relay.example>',
					uuid: 'brevo-uuid',
					email: 'recipient@example.com',
					from: 'Sender <sender@example.com>',
					subject: 'Subject',
					date: '2026-07-17T08:00:00Z'
				}]
			}
		});
		mocks.getTransacEmailContent.mockResolvedValue({
			data: {
				email: 'recipient@example.com',
				subject: 'Subject',
				body: '<p>Hello</p>',
				date: '2026-07-17T08:00:00Z',
				events: []
			}
		});

		const detail = await brevoService.retrieveEmail(
			{ env: { brevo_api_key: 'xkeysib-test' } },
			'abc@relay.example',
			'recipient@example.com'
		);

		expect(mocks.getTransacEmailsList).toHaveBeenCalledWith({
			messageId: '<abc@relay.example>',
			limit: 100,
			sort: 'desc'
		});
		expect(mocks.getTransacEmailContent).toHaveBeenCalledWith({ uuid: 'brevo-uuid' });
		expect(detail.listItem.uuid).toBe('brevo-uuid');
		expect(detail.content.body).toBe('<p>Hello</p>');
	});

	it('maps Brevo list metadata and content response into a complete email row', async () => {
		const row = await brevoService.toEmailRow(
			{ env: {} },
			{
				event: 'delivered',
				email: 'recipient@example.com',
				'message-id': '<abc@relay.example>',
				subject: 'Webhook subject'
			},
			{
				listItem: {
					messageId: '<abc@relay.example>',
					uuid: 'brevo-uuid',
					email: 'recipient@example.com',
					from: 'Sender <sender@example.com>',
					subject: 'List subject',
					date: '2026-07-17T08:00:00Z'
				},
				content: {
					email: 'recipient@example.com',
					subject: 'Detail subject',
					body: '<p>Hello</p>',
					date: '2026-07-17T08:00:00Z',
					events: []
				}
			}
		);

		expect(row).toMatchObject({
			resendEmailId: 'abc@relay.example',
			messageId: '<abc@relay.example>',
			sendEmail: 'sender@example.com',
			name: 'Sender',
			toEmail: 'recipient@example.com',
			subject: 'Detail subject',
			content: '<p>Hello</p>',
			text: 'Hello',
			accountId: 10,
			userId: 20,
			status: emailConst.status.DELIVERED,
			provider: 'brevo'
		});
	});

	it('retrieves and inserts an unknown Brevo email before applying its status', async () => {
		mocks.selectByProviderEmailId.mockResolvedValue(null);
		mocks.claimMissingEmail.mockResolvedValue({
			provider: 'brevo',
			providerEmailId: 'abc@relay.example',
			token: 'missing-token',
			acquired: true
		});
		mocks.insertFromProvider.mockResolvedValue({ emailId: 99 });
		mocks.getTransacEmailsList.mockResolvedValue({
			data: {
				transactionalEmails: [{
					messageId: '<abc@relay.example>',
					uuid: 'brevo-uuid',
					email: 'recipient@example.com',
					from: 'Sender <sender@example.com>',
					subject: 'Subject',
					date: '2026-07-17T08:00:00Z'
				}]
			}
		});
		mocks.getTransacEmailContent.mockResolvedValue({
			data: {
				email: 'recipient@example.com',
				subject: 'Subject',
				body: '<p>Hello</p>',
				date: '2026-07-17T08:00:00Z'
			}
		});

		await brevoService.webhooks(
			{
				env: {
					brevo_api_key: 'xkeysib-test',
					brevo_webhook_secret: 'webhook-secret'
				},
				req: { url: 'https://worker.example/webhooks/brevo' }
			},
			{
				rawPayload: '{}',
				authorization: '',
				webhookSecret: 'webhook-secret',
				body: {
					event: 'delivered',
					'message-id': '<abc@relay.example>',
					email: 'recipient@example.com',
					ts_event: 1_721_234_567
				}
			}
		);

		expect(mocks.insertFromProvider).toHaveBeenCalledWith(
			expect.anything(),
			'brevo',
			'abc@relay.example',
			expect.objectContaining({ provider: 'brevo', subject: 'Subject' })
		);
		expect(mocks.updateProviderEmailStatus).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				provider: 'brevo',
				providerEmailId: 'abc@relay.example',
				emailId: 99,
				status: emailConst.status.DELIVERED
			})
		);
		expect(mocks.completeDelivery).toHaveBeenCalled();
	});

	it('discovers recent Brevo events and skips message IDs already in the system', async () => {
		mocks.getEmailEventReport.mockResolvedValue({
			data: {
				events: [{
					messageId: '<abc@relay.example>',
					email: 'recipient@example.com',
					from: 'Sender <sender@example.com>',
					event: 'delivered',
					date: '2026-07-18T08:00:00Z'
				}, {
					messageId: '<abc@relay.example>',
					email: 'recipient@example.com',
					from: 'Sender <sender@example.com>',
					event: 'opened',
					date: '2026-07-18T08:05:00Z'
				}]
			}
		});
		mocks.selectByProviderEmailId.mockResolvedValue({
			emailId: 99,
			status: emailConst.status.SENT
		});

		const result = await brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-test' }
		});

		expect(mocks.getEmailEventReport).toHaveBeenCalledWith({
			days: 30,
			limit: 5000,
			offset: 0,
			sort: 'desc'
		});
		expect(mocks.selectByProviderEmailId).toHaveBeenCalledTimes(1);
		expect(mocks.selectByProviderEmailId).toHaveBeenCalledWith(
			expect.anything(),
			'brevo',
			'abc@relay.example'
		);
		expect(mocks.getTransacEmailsList).not.toHaveBeenCalled();
		expect(mocks.getTransacEmailContent).not.toHaveBeenCalled();
		expect(mocks.insertFromProvider).not.toHaveBeenCalled();
		expect(mocks.updateProviderEmailStatus).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			configured: true,
			inserted: 0,
			updated: 0,
			skipped: 1,
			errors: []
		});
	});

	it('resolves an unknown event message ID to UUID and imports its detail', async () => {
		mocks.getEmailEventReport.mockResolvedValue({
			data: {
				events: [{
					messageId: '<missing@relay.example>',
					email: 'recipient@example.com',
					from: 'External <external@example.net>',
					event: 'delivered',
					subject: 'Missing message',
					date: '2026-07-18T08:00:00Z'
				}]
			}
		});
		mocks.getTransacEmailsList.mockResolvedValue({
			data: {
				count: 1,
				transactionalEmails: [{
					messageId: '<missing@relay.example>',
					uuid: 'missing-uuid',
					email: 'recipient@example.com',
					subject: 'Missing message',
					date: '2026-07-18T08:00:00Z'
				}]
			}
		});
		mocks.getTransacEmailContent.mockResolvedValue({
			data: {
				email: 'recipient@example.com',
				subject: 'Missing message',
				body: '<p>Recovered</p>',
				date: '2026-07-18T08:00:00Z',
				events: [{
					name: 'delivered',
					time: '2026-07-18T08:00:10Z'
				}]
			}
		});
		mocks.selectByProviderEmailId.mockResolvedValue(null);
		mocks.insertFromProvider.mockResolvedValue({ emailId: 101 });

		const result = await brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-test' }
		});

		expect(mocks.getEmailEventReport).toHaveBeenCalledWith({
			days: 30,
			limit: 5000,
			offset: 0,
			sort: 'desc'
		});
		expect(mocks.getTransacEmailsList).toHaveBeenCalledWith({
			messageId: '<missing@relay.example>',
			limit: 100,
			sort: 'desc'
		});
		expect(mocks.getTransacEmailContent).toHaveBeenCalledWith({
			uuid: 'missing-uuid'
		});
		expect(mocks.insertFromProvider).toHaveBeenCalledWith(
			expect.anything(),
			'brevo',
			'missing@relay.example',
			expect.objectContaining({
				provider: 'brevo',
				subject: 'Missing message',
				sendEmail: 'external@example.net',
				toEmail: 'recipient@example.com'
			})
		);
		expect(result).toMatchObject({
			configured: true,
			inserted: 1,
			updated: 0,
			skipped: 0,
			errors: []
		});
	});

	it('emits structured sync diagnostics without logging secrets or email content', async () => {
		mocks.getEmailEventReport.mockResolvedValue({
			data: {
				events: [{
					messageId: '<diagnostic@relay.example>',
					email: 'private-recipient@example.com',
					from: 'Private Sender <private-sender@example.net>',
					event: 'delivered',
					subject: 'Private subject'
				}]
			}
		});
		mocks.getTransacEmailsList.mockResolvedValue({
			data: {
				count: 1,
				transactionalEmails: [{
					messageId: '<diagnostic@relay.example>',
					uuid: 'diagnostic-uuid',
					email: 'private-recipient@example.com',
					subject: 'Private subject'
				}]
			}
		});
		mocks.getTransacEmailContent.mockResolvedValue({
			data: {
				email: 'private-recipient@example.com',
				subject: 'Private subject',
				body: '<p>Private body</p>',
				events: []
			}
		});
		mocks.selectByProviderEmailId.mockResolvedValue(null);
		mocks.insertFromProvider.mockResolvedValue({ emailId: 202 });

		await brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-private-api-key' }
		});

		const syncLogCalls = infoSpy.mock.calls
			.filter(([entry]) => String(entry).startsWith('[brevo-sync] '));
		expect(syncLogCalls.every(call => call.length === 1)).toBe(true);

		const entries = syncLogCalls.map(([entry]) => (
			JSON.parse(entry.slice('[brevo-sync] '.length))
		));
		const stages = entries.map(entry => entry.stage);
		expect(stages).toEqual(expect.arrayContaining([
			'sync.start',
			'events.request',
			'events.response',
			'message.missing',
			'email-list.request',
			'email-list.response',
			'email-detail.request',
			'email-detail.response',
			'message.inserted',
			'page.complete',
			'sync.complete'
		]));
		expect(entries.find(entry => entry.stage === 'sync.complete')).toMatchObject({
			pages: 1,
			totalEvents: 1,
			inserted: 1,
			errorCount: 0
		});

		const output = JSON.stringify(infoSpy.mock.calls);
		expect(output).not.toContain('xkeysib-private-api-key');
		expect(output).not.toContain('private-recipient@example.com');
		expect(output).not.toContain('private-sender@example.net');
		expect(output).not.toContain('Private subject');
		expect(output).not.toContain('Private body');
	});

	it('reports an event without a message ID and continues processing later events', async () => {
		mocks.getEmailEventReport.mockResolvedValue({
			data: {
				events: [{
					email: 'missing-id@example.com',
					event: 'delivered'
				}, {
					messageId: '<existing@relay.example>',
					email: 'recipient@example.com',
					event: 'delivered'
				}]
			}
		});
		mocks.selectByProviderEmailId.mockResolvedValue({
			emailId: 99,
			status: emailConst.status.SENT
		});

		await expect(brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-test' }
		})).resolves.toEqual({
			configured: true,
			inserted: 0,
			updated: 0,
			skipped: 1,
			errors: ['brevo[events][unknown]: message ID is empty']
		});

		expect(mocks.selectByProviderEmailId).toHaveBeenCalledTimes(1);
		expect(mocks.getTransacEmailsList).not.toHaveBeenCalled();
	});

	it('paginates recent events and deduplicates message IDs across pages', async () => {
		const duplicateEvents = Array.from({ length: 5000 }, () => ({
			messageId: '<existing@relay.example>',
			email: 'recipient@example.com',
			event: 'delivered'
		}));
		mocks.getEmailEventReport
			.mockResolvedValueOnce({ data: { events: duplicateEvents } })
			.mockResolvedValueOnce({ data: { events: [] } });
		mocks.selectByProviderEmailId.mockResolvedValue({
			emailId: 99,
			status: emailConst.status.SENT
		});

		const result = await brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-test' }
		});

		expect(mocks.getEmailEventReport).toHaveBeenNthCalledWith(1, {
			days: 30,
			limit: 5000,
			offset: 0,
			sort: 'desc'
		});
		expect(mocks.getEmailEventReport).toHaveBeenNthCalledWith(2, {
			days: 30,
			limit: 5000,
			offset: 5000,
			sort: 'desc'
		});
		expect(mocks.selectByProviderEmailId).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({
			inserted: 0,
			updated: 0,
			skipped: 1,
			errors: []
		});
	});

	it('returns event report API errors without a false pagination error', async () => {
		mocks.getEmailEventReport.mockRejectedValue({
			body: { message: 'event history denied' }
		});

		await expect(brevoService.syncFromProvider({
			env: { brevo_api_key: 'xkeysib-test' }
		})).resolves.toEqual({
			configured: true,
			inserted: 0,
			updated: 0,
			skipped: 0,
			errors: ['brevo[events]: event history denied']
		});
	});

	it('treats a missing Brevo API key as an unconfigured provider', async () => {
		await expect(brevoService.syncFromProvider({ env: {} })).resolves.toEqual({
			configured: false,
			inserted: 0,
			updated: 0,
			skipped: 0,
			errors: []
		});
	});
});
