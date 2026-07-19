import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dbInit } from '../src/init/init';

const context = { env };
let warnSpy;

const MIGRATIONS = [
	'v1_1DB',
	'v1_2DB',
	'v1_3DB',
	'v1_3_1DB',
	'v1_4DB',
	'v1_5DB',
	'v1_6DB',
	'v1_7DB',
	'v2DB',
	'v2_3DB',
	'v2_4DB',
	'v2_5DB',
	'v2_6DB',
	'v2_7DB',
	'v2_8DB',
	'v2_9DB',
	'v3_0DB',
	'v3_1DB',
	'v3_2DB',
	'v3_3DB',
	'v3_4DB',
	'v3_5DB',
	'v3_6DB',
	'v3_7DB',
	'v3_8DB'
];

async function columnNames(table) {
	const rows = await env.db.prepare(`PRAGMA table_info(${table})`).all();
	return rows.results.map(column => column.name);
}

async function runAllMigrations() {
	for (const migration of MIGRATIONS) {
		await dbInit[migration](context);
	}
}

describe('idempotent D1 column migrations', () => {
	beforeEach(async () => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const table of [
			'role_perm',
			'role',
			'perm',
			'setting',
			'account',
			'user',
			'attachments',
			'star',
			'email'
		]) {
			await env.db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
		}
		await dbInit.intDB(context);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('adds missing columns when another column in the same migration already exists', async () => {
		await env.db.prepare(`
			ALTER TABLE email
			ADD COLUMN code TEXT NOT NULL DEFAULT ''
		`).run();

		await dbInit.v3_0DB(context);

		expect(await columnNames('email')).toContain('code');
		expect(await columnNames('setting')).toEqual(expect.arrayContaining([
			'ai_code',
			'ai_code_filter',
			'black_subject',
			'black_content',
			'black_from'
		]));
		expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('duplicate column name');
	});

	it('can rerun the legacy column migration without duplicate-column warnings', async () => {
		await dbInit.v1_1DB(context);
		warnSpy.mockClear();

		await dbInit.v1_1DB(context);

		expect(await columnNames('email')).toEqual(expect.arrayContaining([
			'type',
			'status',
			'resend_email_id',
			'message'
		]));
		expect(await columnNames('setting')).toEqual(expect.arrayContaining([
			'resend_tokens',
			'send',
			'r2_domain',
			'site_key',
			'secret_key',
			'background',
			'login_opacity'
		]));
		expect(await columnNames('user')).toEqual(expect.arrayContaining([
			'create_ip',
			'active_ip',
			'os',
			'browser',
			'device',
			'sort',
			'send_count'
		]));
		expect(await columnNames('attachments')).toEqual(expect.arrayContaining([
			'status',
			'type'
		]));
		expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('duplicate column name');
	});

	it('reconciles every field in a partially applied recipient migration', async () => {
		await env.db.prepare(`
			ALTER TABLE email
			ADD COLUMN recipient TEXT NOT NULL DEFAULT '[]'
		`).run();

		await dbInit.v1_2DB(context);

		expect(await columnNames('email')).toEqual(expect.arrayContaining([
			'recipient',
			'cc',
			'bcc',
			'message_id',
			'in_reply_to',
			'relation'
		]));
		expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('duplicate column name');
	});

	it('reruns the complete migration chain without duplicate-column warnings', async () => {
		await runAllMigrations();
		warnSpy.mockClear();

		await runAllMigrations();

		expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('duplicate column name');
	});
});
