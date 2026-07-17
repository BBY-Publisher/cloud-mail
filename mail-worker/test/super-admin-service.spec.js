import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getUser: vi.fn(),
	querySetting: vi.fn(),
	isAdmin: vi.fn()
}));

vi.mock('../src/security/user-context', () => ({
	default: {
		getUser: mocks.getUser
	}
}));

vi.mock('../src/service/setting-service', () => ({
	default: {
		query: mocks.querySetting,
		isAdmin: mocks.isAdmin
	}
}));

import superAdminService from '../src/service/super-admin-service';

describe('super admin authorization', () => {
	beforeEach(() => {
		for (const mock of Object.values(mocks)) mock.mockReset();
		mocks.getUser.mockReturnValue({ userId: 10, email: 'admin@example.com' });
		mocks.querySetting.mockResolvedValue({ adminEmails: ['admin@example.com'] });
	});

	it('allows a configured super administrator', async () => {
		mocks.isAdmin.mockReturnValue(true);

		await expect(superAdminService.require(c())).resolves.toMatchObject({
			userId: 10,
			email: 'admin@example.com'
		});
	});

	it('rejects a role user even if another permission allowed the route', async () => {
		mocks.isAdmin.mockReturnValue(false);

		await expect(superAdminService.require(c())).rejects.toMatchObject({
			code: 403
		});
	});
});

function c() {
	return { env: {} };
}
