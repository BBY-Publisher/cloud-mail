import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	syncResend: vi.fn(),
	syncBrevo: vi.fn()
}));

vi.mock('../src/service/resend-service', () => ({
	default: {
		syncFromProvider: mocks.syncResend
	}
}));

vi.mock('../src/service/brevo-service', () => ({
	default: {
		syncFromProvider: mocks.syncBrevo
	}
}));

import providerSyncService from '../src/service/provider-sync-service';

describe('provider sync aggregation', () => {
	beforeEach(() => {
		for (const mock of Object.values(mocks)) mock.mockReset();
	});

	it('aggregates imported, updated and skipped messages', async () => {
		mocks.syncResend.mockResolvedValue({
			configured: true,
			inserted: 2,
			updated: 3,
			skipped: 4,
			errors: []
		});
		mocks.syncBrevo.mockResolvedValue({
			configured: true,
			inserted: 5,
			updated: 6,
			skipped: 7,
			errors: ['one detail failed']
		});

		await expect(providerSyncService.sync({ env: {} })).resolves.toEqual({
			configured: true,
			inserted: 7,
			updated: 9,
			skipped: 11,
			errors: ['one detail failed'],
			providers: {
				resend: expect.any(Object),
				brevo: expect.any(Object)
			}
		});
	});

	it('reports when neither provider is configured', async () => {
		const empty = {
			configured: false,
			inserted: 0,
			updated: 0,
			skipped: 0,
			errors: []
		};
		mocks.syncResend.mockResolvedValue(empty);
		mocks.syncBrevo.mockResolvedValue(empty);

		await expect(providerSyncService.sync({ env: {} })).resolves.toMatchObject({
			configured: false,
			inserted: 0,
			updated: 0,
			skipped: 0,
			errors: []
		});
	});
});
