import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import emailService from '../src/service/email-service';

const context = { env };

describe('email provider ID selection', () => {
	beforeEach(async () => {
		await env.db.prepare('DROP TABLE IF EXISTS email').run();
		await env.db.prepare(`
			CREATE TABLE email (
				email_id INTEGER PRIMARY KEY AUTOINCREMENT,
				resend_email_id TEXT,
				provider TEXT,
				is_del INTEGER NOT NULL DEFAULT 0
			)
		`).run();
	});

	it('returns unique normalized active IDs for only the requested provider', async () => {
		await env.db.prepare(`
			INSERT INTO email (resend_email_id, provider, is_del) VALUES
				('<abc@relay.example>', 'brevo', 0),
				('abc@relay.example', 'brevo', 0),
				('deleted@relay.example', 'brevo', 1),
				('resend-id', 'resend', 0),
				('legacy-id', NULL, 0),
				('', 'brevo', 0),
				(NULL, 'brevo', 0)
		`).run();

		await expect(emailService.selectProviderEmailIds(context, 'brevo'))
			.resolves.toEqual(['abc@relay.example']);
	});
});
