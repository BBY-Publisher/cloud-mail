import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	selectByEmailIncludeDel: vi.fn(),
	verify: vi.fn(),
	getEmail: vi.fn(),
	querySetting: vi.fn(),
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

vi.mock('resend', () => ({
	Resend: class {
		constructor() {
			this.webhooks = { verify: mocks.verify };
			this.emails = {
				get: mocks.getEmail,
				receiving: { get: mocks.getEmail }
			};
		}
	}
}));

vi.mock('../src/service/account-service', () => ({
	default: {
		selectByEmailIncludeDel: mocks.selectByEmailIncludeDel
	}
}));

vi.mock('../src/service/setting-service', () => ({
	default: {
		query: mocks.querySetting
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

import resendService, {
	buildResendStatusParams
} from '../src/service/resend-service';

describe('Resend webhook contract', () => {
	beforeEach(() => {
		for (const mock of Object.values(mocks)) mock.mockReset();
		mocks.selectByEmailIncludeDel.mockResolvedValue({
			accountId: 10,
			userId: 20
		});
		mocks.querySetting.mockResolvedValue({
			resendTokens: { 'sender.example': 're_test' }
		});
		mocks.claimDelivery.mockResolvedValue({
			provider: 'resend',
			eventKey: 'svix-event',
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

	it('includes provider identity in status updates', () => {
		expect(buildResendStatusParams({
			type: 'email.delivered',
			data: { email_id: 'resend-id' }
		})).toMatchObject({
			provider: 'resend',
			providerEmailId: 'resend-id'
		});
	});

	it('marks backfilled rows as Resend provider rows', async () => {
		const row = await resendService.toEmailRow(
			{ env: {} },
			{
				type: 'email.sent',
				created_at: '2026-07-17T08:00:01Z',
				data: {
					email_id: 'resend-id',
					from: 'Sender <sender@example.com>',
					to: ['recipient@example.com'],
					subject: 'Subject'
				}
			},
			{
				id: 'resend-id',
				from: 'Sender <sender@example.com>',
				to: ['recipient@example.com'],
				cc: [],
				bcc: [],
				subject: 'Subject',
				html: '<p>Hello</p>',
				text: 'Hello',
				last_event: 'sent',
				created_at: '2026-07-17T08:00:00Z'
			}
		);

		expect(row).toMatchObject({
			resendEmailId: 'resend-id',
			provider: 'resend'
		});
	});

	it('retrieves and inserts an unknown Resend email before applying its status', async () => {
		const body = {
			type: 'email.delivered',
			created_at: '2026-07-17T08:00:01Z',
			data: {
				email_id: 'resend-id',
				from: 'Sender <sender@sender.example>',
				to: ['recipient@example.com'],
				subject: 'Subject'
			}
		};
		mocks.verify.mockResolvedValue(body);
		mocks.selectByProviderEmailId.mockResolvedValue(null);
		mocks.claimMissingEmail.mockResolvedValue({
			provider: 'resend',
			providerEmailId: 'resend-id',
			token: 'missing-token',
			acquired: true
		});
		mocks.getEmail.mockResolvedValue({
			data: {
				id: 'resend-id',
				from: 'Sender <sender@sender.example>',
				to: ['recipient@example.com'],
				subject: 'Subject',
				html: '<p>Hello</p>',
				text: 'Hello',
				last_event: 'delivered',
				created_at: '2026-07-17T08:00:00Z'
			}
		});
		mocks.insertFromProvider.mockResolvedValue({ emailId: 88 });

		await resendService.webhooks(
			{ env: { resend_webhook_secret: 'whsec_test' } },
			{
				payload: JSON.stringify(body),
				headers: {
					id: 'svix-event',
					timestamp: '1',
					signature: 'signature'
				}
			}
		);

		expect(mocks.insertFromProvider).toHaveBeenCalledWith(
			expect.anything(),
			'resend',
			'resend-id',
			expect.objectContaining({ provider: 'resend', subject: 'Subject' })
		);
		expect(mocks.updateProviderEmailStatus).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				provider: 'resend',
				providerEmailId: 'resend-id',
				emailId: 88,
				status: 2
			})
		);
		expect(mocks.completeDelivery).toHaveBeenCalled();
	});
});
