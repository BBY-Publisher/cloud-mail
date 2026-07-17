import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import providerWebhookStateService, {
	ensureWebhookSyncSchema
} from '../src/service/provider-webhook-state-service';

const context = { env };

async function seedEmail(providerEmailId, status = 1) {
	await context.env.db.prepare(`
		CREATE TABLE IF NOT EXISTS email (
			email_id INTEGER PRIMARY KEY AUTOINCREMENT,
			resend_email_id TEXT,
			provider TEXT,
			status INTEGER NOT NULL DEFAULT 0,
			message TEXT
		)
	`).run();

	return context.env.db.prepare(`
		INSERT INTO email (resend_email_id, provider, status)
		VALUES (?, ?, ?)
		RETURNING email_id
	`).bind(providerEmailId, 'resend', status).first();
}

describe('provider webhook state storage', () => {
	beforeEach(async () => {
		// The Workers test pool resets D1 between tests but reuses the binding
		// object, so force the schema check for each isolated database.
		await ensureWebhookSyncSchema(context, true);
	});

	it('adds only side tables and leaves an existing email table unchanged', async () => {
		await seedEmail('legacy-email');
		const before = await context.env.db.prepare('PRAGMA table_info(email)').all();

		await ensureWebhookSyncSchema(context);

		const after = await context.env.db.prepare('PRAGMA table_info(email)').all();
		expect(after.results.map(column => column.name))
			.toEqual(before.results.map(column => column.name));
		expect(await context.env.db.prepare(`
			SELECT name FROM sqlite_master
			WHERE type = 'table' AND name = 'provider_email_state'
		`).first()).toBeTruthy();
		expect(await context.env.db.prepare(`
			SELECT name FROM sqlite_master
			WHERE type = 'table' AND name = 'webhook_delivery'
		`).first()).toBeTruthy();
	});

	it('claims a delivery only once and recognizes a completed duplicate', async () => {
		const first = await providerWebhookStateService.claimDelivery(context, {
			provider: 'resend',
			eventKey: 'evt-1',
			eventTime: 1000
		});
		expect(first.acquired).toBe(true);

		const concurrent = await providerWebhookStateService.claimDelivery(context, {
			provider: 'resend',
			eventKey: 'evt-1',
			eventTime: 1000
		});
		expect(concurrent).toMatchObject({ acquired: false, duplicate: false });

		await providerWebhookStateService.completeDelivery(context, first);
		const duplicate = await providerWebhookStateService.claimDelivery(context, {
			provider: 'resend',
			eventKey: 'evt-1',
			eventTime: 1000
		});
		expect(duplicate).toMatchObject({ acquired: false, duplicate: true });
	});

	it('links a provider ID without changing the existing email schema', async () => {
		const row = await seedEmail('email-1');
		await providerWebhookStateService.linkEmail(context, {
			provider: 'resend',
			providerEmailId: 'email-1',
			emailId: row.email_id
		});

		expect(await providerWebhookStateService.findLinkedEmailId(context, {
			provider: 'resend',
			providerEmailId: 'email-1'
		})).toBe(row.email_id);
	});

	it('can clear a stale link before backfilling a deleted email again', async () => {
		const row = await seedEmail('email-stale');
		const params = {
			provider: 'resend',
			providerEmailId: 'email-stale',
			emailId: row.email_id
		};
		await providerWebhookStateService.linkEmail(context, params);
		await providerWebhookStateService.unlinkMissingEmail(context, params);

		expect(await providerWebhookStateService.findLinkedEmailId(context, params)).toBeNull();
		expect(await providerWebhookStateService.claimMissingEmail(context, params))
			.toMatchObject({ acquired: true });
	});

	it('prevents an older delivery event from overwriting a newer status', async () => {
		const row = await seedEmail('email-2');
		const base = {
			provider: 'resend',
			providerEmailId: 'email-2',
			emailId: row.email_id
		};

		expect(await providerWebhookStateService.updateStatusIfNewer(context, {
			...base,
			status: 2,
			statusRank: 30,
			eventTime: 2000
		})).toBe(true);

		expect(await providerWebhookStateService.updateStatusIfNewer(context, {
			...base,
			status: 1,
			statusRank: 10,
			eventTime: 1000
		})).toBe(false);

		const stored = await context.env.db.prepare(
			'SELECT status FROM email WHERE email_id = ?'
		).bind(row.email_id).first();
		expect(stored.status).toBe(2);
	});

	it('uses status rank to make equal-timestamp transitions deterministic', async () => {
		const row = await seedEmail('email-3');
		const base = {
			provider: 'resend',
			providerEmailId: 'email-3',
			emailId: row.email_id,
			eventTime: 3000
		};

		await providerWebhookStateService.updateStatusIfNewer(context, {
			...base,
			status: 5,
			statusRank: 20
		});
		expect(await providerWebhookStateService.updateStatusIfNewer(context, {
			...base,
			status: 2,
			statusRank: 30
		})).toBe(true);
		expect(await providerWebhookStateService.updateStatusIfNewer(context, {
			...base,
			status: 1,
			statusRank: 10
		})).toBe(false);
	});

	it('reconciles the email row when the same provider event is retried', async () => {
		const row = await seedEmail('email-retry');
		const event = {
			provider: 'resend',
			providerEmailId: 'email-retry',
			emailId: row.email_id,
			status: 2,
			statusRank: 30,
			eventTime: 4000
		};

		await providerWebhookStateService.updateStatusIfNewer(context, event);
		await context.env.db.prepare(
			'UPDATE email SET status = 1 WHERE email_id = ?'
		).bind(row.email_id).run();

		expect(await providerWebhookStateService.updateStatusIfNewer(context, event)).toBe(true);
		const stored = await context.env.db.prepare(
			'SELECT status FROM email WHERE email_id = ?'
		).bind(row.email_id).first();
		expect(stored.status).toBe(2);
	});
});
