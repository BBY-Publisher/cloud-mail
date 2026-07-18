import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { dbInit } from '../src/init/init';

describe('Brevo webhook setting migration', () => {
	beforeEach(async () => {
		await env.db.prepare('DROP TABLE IF EXISTS setting').run();
		await env.db.prepare(`
			CREATE TABLE setting (
				title TEXT NOT NULL DEFAULT ''
			)
		`).run();
		await env.db.prepare(`INSERT INTO setting (title) VALUES ('Cloud Mail')`).run();
	});

	it('seeds the setting once from the Worker env', async () => {
		await dbInit.v3_8DB({
			env: {
				db: env.db,
				brevo_webhook_secret: 'env-secret'
			}
		});

		expect(await readSecret()).toBe('env-secret');

		await env.db.prepare(`
			UPDATE setting SET brevo_webhook_secret = 'saved-secret'
		`).run();
		await dbInit.v3_8DB({
			env: {
				db: env.db,
				brevo_webhook_secret: 'changed-env-secret'
			}
		});

		expect(await readSecret()).toBe('saved-secret');
	});

	it('creates an empty configurable setting when the env is absent', async () => {
		await dbInit.v3_8DB({ env: { db: env.db } });

		expect(await readSecret()).toBe('');
	});
});

async function readSecret() {
	const row = await env.db.prepare(`
		SELECT brevo_webhook_secret AS brevoWebhookSecret
		FROM setting
	`).first();
	return row.brevoWebhookSecret;
}
