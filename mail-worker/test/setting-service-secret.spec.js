import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	selectVerifyRecords: vi.fn(),
	storageType: vi.fn()
}));

vi.mock('../src/service/verify-record-service', () => ({
	default: {
		selectListByIP: mocks.selectVerifyRecords
	}
}));

vi.mock('../src/service/r2-service', () => ({
	default: {
		storageType: mocks.storageType
	}
}));

import settingService from '../src/service/setting-service';

describe('setting secret exposure', () => {
	beforeEach(() => {
		mocks.selectVerifyRecords.mockReset();
		mocks.storageType.mockReset();
		mocks.selectVerifyRecords.mockResolvedValue([]);
		mocks.storageType.mockResolvedValue('kv');
	});

	it('returns only the Brevo webhook configured state', async () => {
		vi.spyOn(settingService, 'query').mockResolvedValue({
			brevoWebhookSecret: 'private-webhook-secret',
			resendTokens: {},
			siteKey: null,
			secretKey: null,
			s3AccessKey: '',
			s3SecretKey: '',
			tgBotToken: ''
		});

		const result = await settingService.get({ env: {} });

		expect(result.hasBrevoWebhookSecret).toBe(true);
		expect(result.brevoWebhookSecret).toBeUndefined();
	});
});
