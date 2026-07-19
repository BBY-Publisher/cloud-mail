import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	querySetting: vi.fn()
}));

vi.mock('../src/service/setting-service', () => ({
	default: {
		query: mocks.querySetting
	}
}));

import emailService from '../src/service/email-service';

const context = {
	env: {
		db: env.db,
		brevo_api_key: 'xkeysib-test'
	}
};

describe('provider account email selection', () => {
	beforeEach(async () => {
		mocks.querySetting.mockReset();
		mocks.querySetting.mockResolvedValue({
			resendTokens: {
				'resend.example': 're_test'
			},
			domainProviders: {
				'override.example': 'brevo'
			}
		});
		await env.db.prepare('DROP TABLE IF EXISTS account').run();
		await env.db.prepare(`
			CREATE TABLE account (
				account_id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL,
				status INTEGER NOT NULL DEFAULT 0,
				is_del INTEGER NOT NULL DEFAULT 0
			)
		`).run();
	});

	it('returns active system account emails whose effective provider is Brevo', async () => {
		await env.db.prepare(`
			INSERT INTO account (email, status, is_del) VALUES
				('default@example.com', 0, 0),
				('override@override.example', 0, 0),
				('resend@resend.example', 0, 0),
				('deleted@example.com', 0, 1),
				('disabled@example.com', 1, 0)
		`).run();

		await expect(emailService.selectProviderAccountEmails(context, 'brevo'))
			.resolves.toEqual([
				'default@example.com',
				'override@override.example'
			]);
	});
});
