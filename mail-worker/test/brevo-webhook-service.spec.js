import { beforeEach, describe, expect, it, vi } from 'vitest';
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
	recordWebhookEvent: vi.fn()
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

import brevoService, {
	buildBrevoStatusParams,
	getBrevoMessageId
} from '../src/service/brevo-service';

describe('Brevo webhook contract', () => {
	beforeEach(() => {
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
		mocks.updateProviderEmailStatus.mockResolvedValue(true);
	});

	it('reads the official message-id field and normalizes it', () => {
		expect(getBrevoMessageId({
			'message-id': '<abc@relay.example>'
		})).toBe('abc@relay.example');
	});

	it('accepts Brevo static custom-header and bearer credentials', async () => {
		const c = { env: { brevo_webhook_secret: 'webhook-secret' } };

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

	it.each([
		['request', emailConst.status.SENT],
		['delivered', emailConst.status.DELIVERED],
		['soft_bounce', emailConst.status.BOUNCED],
		['hard_bounce', emailConst.status.BOUNCED],
		['invalid_email', emailConst.status.BOUNCED],
		['blocked', emailConst.status.FAILED],
		['error', emailConst.status.FAILED],
		['deferred', emailConst.status.DELAYED],
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

	it('actively updates the status of an existing Brevo email from detail events', async () => {
		mocks.getEmailEventReport.mockResolvedValue({
			data: {
				events: [{
					messageId: '<abc@relay.example>',
					email: 'recipient@example.com',
					event: 'delivered',
					date: '2026-07-17T08:00:10Z'
				}, {
					messageId: '<abc@relay.example>',
					email: 'recipient@example.com',
					event: 'requests',
					date: '2026-07-17T08:00:00Z'
				}]
			}
		});
		mocks.getTransacEmailsList.mockResolvedValue({
			data: {
				count: 1,
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
				events: [{
					name: 'delivered',
					time: '2026-07-17T08:00:10Z'
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

		expect(mocks.updateProviderEmailStatus).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				provider: 'brevo',
				providerEmailId: 'abc@relay.example',
				emailId: 99,
				status: emailConst.status.DELIVERED,
				eventTime: Date.parse('2026-07-17T08:00:10Z')
			})
		);
		expect(result).toMatchObject({
			configured: true,
			inserted: 0,
			updated: 1,
			skipped: 0,
			errors: []
		});
		expect(mocks.getEmailEventReport).toHaveBeenCalledWith({
			limit: 100,
			offset: 0,
			sort: 'desc'
		});
		expect(mocks.getTransacEmailsList).toHaveBeenCalledWith({
			messageId: '<abc@relay.example>',
			limit: 100,
			sort: 'desc'
		});
		expect(mocks.getTransacEmailsList).toHaveBeenCalledTimes(1);
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
