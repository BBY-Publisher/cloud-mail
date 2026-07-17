const LOCK_TTL_MS = 60_000;
const schemaPromises = new WeakMap();

export const WEBHOOK_SYNC_SCHEMA_STATEMENTS = [
	`
		CREATE TABLE IF NOT EXISTS provider_email_state (
			provider TEXT NOT NULL,
			provider_email_id TEXT NOT NULL,
			email_id INTEGER,
			status_time INTEGER,
			status_rank INTEGER NOT NULL DEFAULT 0,
			lock_token TEXT,
			lock_time INTEGER,
			create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (provider, provider_email_id)
		)
	`,
	`
		CREATE INDEX IF NOT EXISTS idx_provider_email_state_email_id
		ON provider_email_state(email_id)
	`,
	`
		CREATE TABLE IF NOT EXISTS webhook_delivery (
			provider TEXT NOT NULL,
			event_key TEXT NOT NULL,
			event_time INTEGER,
			process_status TEXT NOT NULL DEFAULT 'processing',
			error_message TEXT,
			attempts INTEGER NOT NULL DEFAULT 1,
			lock_token TEXT,
			lock_time INTEGER,
			create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (provider, event_key)
		)
	`,
	`
		CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status
		ON webhook_delivery(process_status, update_time)
	`
];

export async function ensureWebhookSyncSchema(c, force = false) {
	const db = c.env.db;
	if (force) schemaPromises.delete(db);
	let promise = schemaPromises.get(db);
	if (!promise) {
		promise = (async () => {
			for (const statement of WEBHOOK_SYNC_SCHEMA_STATEMENTS) {
				await db.prepare(statement).run();
			}
		})();
		schemaPromises.set(db, promise);
	}

	try {
		await promise;
	} catch (error) {
		schemaPromises.delete(db);
		throw error;
	}
}

function changes(result) {
	return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function nowMs() {
	return Date.now();
}

function newToken() {
	return crypto.randomUUID();
}

const providerWebhookStateService = {

	ensureSchema: ensureWebhookSyncSchema,

	async claimDelivery(c, params) {
		await ensureWebhookSyncSchema(c);

		const provider = String(params.provider || '');
		const eventKey = String(params.eventKey || '');
		const eventTime = Number(params.eventTime) || nowMs();
		const token = newToken();
		const lockTime = nowMs();

		try {
			await c.env.db.prepare(`
				DELETE FROM webhook_delivery
				WHERE process_status IN ('success', 'ignored')
					AND update_time <= datetime('now', '-30 days')
			`).run();
		} catch (_) {
			// Retention cleanup is best-effort and must not block webhooks.
		}

		await c.env.db.prepare(`
			INSERT OR IGNORE INTO webhook_delivery (
				provider, event_key, event_time, process_status,
				attempts, lock_token, lock_time
			) VALUES (?, ?, ?, 'processing', 1, ?, ?)
		`).bind(provider, eventKey, eventTime, token, lockTime).run();

		let row = await c.env.db.prepare(`
			SELECT process_status, lock_token, lock_time
			FROM webhook_delivery
			WHERE provider = ? AND event_key = ?
		`).bind(provider, eventKey).first();

		if (row?.lock_token === token) {
			return { provider, eventKey, token, acquired: true, duplicate: false };
		}

		if (row?.process_status === 'success' || row?.process_status === 'ignored') {
			return { provider, eventKey, acquired: false, duplicate: true };
		}

		const staleBefore = lockTime - LOCK_TTL_MS;
		await c.env.db.prepare(`
			UPDATE webhook_delivery
			SET process_status = 'processing',
				error_message = NULL,
				attempts = attempts + 1,
				lock_token = ?,
				lock_time = ?,
				update_time = CURRENT_TIMESTAMP
			WHERE provider = ?
				AND event_key = ?
				AND (
					process_status = 'failed'
					OR (
						process_status = 'processing'
						AND (lock_time IS NULL OR lock_time < ?)
					)
				)
		`).bind(token, lockTime, provider, eventKey, staleBefore).run();

		row = await c.env.db.prepare(`
			SELECT process_status, lock_token
			FROM webhook_delivery
			WHERE provider = ? AND event_key = ?
		`).bind(provider, eventKey).first();

		return {
			provider,
			eventKey,
			token: row?.lock_token === token ? token : undefined,
			acquired: row?.lock_token === token,
			duplicate: row?.process_status === 'success' || row?.process_status === 'ignored'
		};
	},

	async completeDelivery(c, claim, ignored = false) {
		if (!claim?.token) return;

		await c.env.db.prepare(`
			UPDATE webhook_delivery
			SET process_status = ?,
				error_message = NULL,
				lock_token = NULL,
				lock_time = NULL,
				update_time = CURRENT_TIMESTAMP
			WHERE provider = ? AND event_key = ? AND lock_token = ?
		`).bind(
			ignored ? 'ignored' : 'success',
			claim.provider,
			claim.eventKey,
			claim.token
		).run();
	},

	async failDelivery(c, claim, error) {
		if (!claim?.token) return;

		await c.env.db.prepare(`
			UPDATE webhook_delivery
			SET process_status = 'failed',
				error_message = ?,
				lock_token = NULL,
				lock_time = NULL,
				update_time = CURRENT_TIMESTAMP
			WHERE provider = ? AND event_key = ? AND lock_token = ?
		`).bind(
			String(error?.message || error || 'unknown error').slice(0, 1000),
			claim.provider,
			claim.eventKey,
			claim.token
		).run();
	},

	async findLinkedEmailId(c, params) {
		await ensureWebhookSyncSchema(c);
		const row = await c.env.db.prepare(`
			SELECT email_id
			FROM provider_email_state
			WHERE provider = ? AND provider_email_id = ?
		`).bind(params.provider, params.providerEmailId).first();
		return row?.email_id == null ? null : Number(row.email_id);
	},

	async linkEmail(c, params) {
		await ensureWebhookSyncSchema(c);
		await c.env.db.prepare(`
			INSERT INTO provider_email_state (
				provider, provider_email_id, email_id
			) VALUES (?, ?, ?)
			ON CONFLICT(provider, provider_email_id) DO UPDATE SET
				email_id = COALESCE(provider_email_state.email_id, excluded.email_id),
				lock_token = NULL,
				lock_time = NULL,
				update_time = CURRENT_TIMESTAMP
		`).bind(params.provider, params.providerEmailId, params.emailId).run();

		return this.findLinkedEmailId(c, params);
	},

	async unlinkMissingEmail(c, params) {
		await ensureWebhookSyncSchema(c);
		await c.env.db.prepare(`
			UPDATE provider_email_state
			SET email_id = NULL, update_time = CURRENT_TIMESTAMP
			WHERE provider = ? AND provider_email_id = ? AND email_id = ?
		`).bind(params.provider, params.providerEmailId, params.emailId).run();
	},

	async claimMissingEmail(c, params) {
		await ensureWebhookSyncSchema(c);

		const token = newToken();
		const lockTime = nowMs();
		await c.env.db.prepare(`
			INSERT OR IGNORE INTO provider_email_state (
				provider, provider_email_id, lock_token, lock_time
			) VALUES (?, ?, ?, ?)
		`).bind(params.provider, params.providerEmailId, token, lockTime).run();

		let row = await c.env.db.prepare(`
			SELECT email_id, lock_token
			FROM provider_email_state
			WHERE provider = ? AND provider_email_id = ?
		`).bind(params.provider, params.providerEmailId).first();

		if (row?.email_id != null) {
			return { acquired: false, emailId: Number(row.email_id) };
		}
		if (row?.lock_token === token) {
			return { ...params, acquired: true, token };
		}

		await c.env.db.prepare(`
			UPDATE provider_email_state
			SET lock_token = ?, lock_time = ?, update_time = CURRENT_TIMESTAMP
			WHERE provider = ?
				AND provider_email_id = ?
				AND email_id IS NULL
				AND (lock_time IS NULL OR lock_time < ?)
		`).bind(
			token,
			lockTime,
			params.provider,
			params.providerEmailId,
			lockTime - LOCK_TTL_MS
		).run();

		row = await c.env.db.prepare(`
			SELECT email_id, lock_token
			FROM provider_email_state
			WHERE provider = ? AND provider_email_id = ?
		`).bind(params.provider, params.providerEmailId).first();

		return {
			...params,
			acquired: row?.lock_token === token,
			token: row?.lock_token === token ? token : undefined,
			emailId: row?.email_id == null ? null : Number(row.email_id)
		};
	},

	async releaseMissingEmailClaim(c, claim) {
		if (!claim?.token) return;
		await c.env.db.prepare(`
			UPDATE provider_email_state
			SET lock_token = NULL, lock_time = NULL, update_time = CURRENT_TIMESTAMP
			WHERE provider = ? AND provider_email_id = ? AND lock_token = ?
		`).bind(claim.provider, claim.providerEmailId, claim.token).run();
	},

	async updateStatusIfNewer(c, params) {
		await this.linkEmail(c, params);

		const eventTime = Number(params.eventTime) || nowMs();
		const statusRank = Number(params.statusRank) || 0;
		const stateStatement = c.env.db.prepare(`
			UPDATE provider_email_state
			SET status_time = ?,
				status_rank = ?,
				update_time = CURRENT_TIMESTAMP
			WHERE provider = ?
				AND provider_email_id = ?
				AND (
					status_time IS NULL
					OR status_time < ?
					OR (status_time = ? AND status_rank <= ?)
				)
		`).bind(
			eventTime,
			statusRank,
			params.provider,
			params.providerEmailId,
			eventTime,
			eventTime,
			statusRank
		);

		const emailStatement = c.env.db.prepare(`
			UPDATE email
			SET status = ?,
				message = ?,
				provider = COALESCE(provider, ?)
			WHERE email_id = ?
				AND EXISTS (
					SELECT 1
					FROM provider_email_state
					WHERE provider = ?
						AND provider_email_id = ?
						AND email_id = ?
						AND status_time = ?
						AND status_rank = ?
				)
		`).bind(
			params.status,
			params.message || null,
			params.provider,
			params.emailId,
			params.provider,
			params.providerEmailId,
			params.emailId,
			eventTime,
			statusRank
		);

		// D1 executes a batch as one transaction. Keeping the cursor and email
		// row together prevents a retry from observing only half of an update.
		const [, emailResult] = await c.env.db.batch([stateStatement, emailStatement]);
		return changes(emailResult) > 0;
	}
};

export default providerWebhookStateService;
