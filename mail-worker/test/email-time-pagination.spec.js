import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import email from '../src/entity/email';
import account from '../src/entity/account';
import user from '../src/entity/user';
import { star } from '../src/entity/star';
import emailService from '../src/service/email-service';
import accountMemberService from '../src/service/account-member-service';
import { dbInit as init } from '../src/init/init';

const c = { env };
const page = (params = {}) => emailService.list(c, {
	accountId: 1, allReceive: 0, size: 2, timeSort: 0, type: 1, ...params
}, 7);
const ids = result => result.list.map(row => row.emailId);

beforeEach(async () => {
	for (const [name, table] of [['email', email], ['account', account], ['star', star], ['user', user]]) {
		await env.db.prepare(`CREATE TABLE ${name} (${Object.values(getTableColumns(table))
			.map(column => `"${column.name}" ${column.getSQLType()}`).join(', ')})`).run();
	}
	await env.db.prepare('INSERT INTO account (account_id, is_del) VALUES (1, 0), (2, 0)').run();
	for (const [id, time, accountId] of [
		[1, '2026-07-19 08:00:00', 1],
		[2, '2026-07-18T16:00:00+08:00', 1],
		[3, '2026-07-18 08:00:00.000', 1],
		[4, '2026-07-17T08:00:00Z', 1], // Imported last, sent first.
		[5, '2026-07-20 08:00:00', 2]
	]) {
		await env.db.prepare(`INSERT INTO email (email_id, create_time, account_id, user_id, type, status, is_del, provider, resend_email_id)
			VALUES (?, ?, ?, 7, 1, 2, 0, 'brevo', ?)`).bind(id, time, accountId, `message-${id}`).run();
	}
	vi.spyOn(accountMemberService, 'listAccessibleAccountIds').mockResolvedValue([1]);
	vi.spyOn(emailService, 'emailAddAtt').mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());

describe('mail time ordering and cursor pagination', () => {
	it('orders imported mail by send time, using ID for equal timestamps', async () => {
		const first = await page();
		expect(ids(first)).toEqual([1, 3]);
		expect(first.total).toBe(4);
		const second = await page({ emailId: 3, cursorTime: first.list[1].createTime });
		expect(ids(second)).toEqual([2, 4]);
		expect(second.total).toBe(4);
		expect(ids(await page({ emailId: 4, cursorTime: second.list[1].createTime }))).toEqual([]);
	});
	it('supports ascending pages and legacy clients that send only the ID', async () => {
		expect(ids(await page({ timeSort: 1 }))).toEqual([4, 2]);
		expect(ids(await page({ timeSort: 1, emailId: 2 }))).toEqual([3, 1]);
	});
	it('keeps the cursor stable when its row is deleted', async () => {
		const first = await page();
		await env.db.prepare('DELETE FROM email WHERE email_id = 3').run();
		expect(ids(await page({ emailId: 3, cursorTime: first.list[1].createTime }))).toEqual([2, 4]);
	});
	it('uses the same ordering for the admin list and preserves filters', async () => {
		const first = await emailService.allList(c, { size: 2, type: 'send' });
		expect(ids(first)).toEqual([5, 1]);
		const second = await emailService.allList(c, { size: 2, type: 'send', emailId: 1, cursorTime: first.list[1].createTime });
		expect(ids(second)).toEqual([3, 2]);
		expect(second.total).toBe(5);
	});
	it('repairs only the timestamp and is idempotent without overwriting concurrent changes', async () => {
		const row = (await page()).list[0];
		expect(await emailService.repairBrevoEmailTime(c, row, '2026-07-16 08:00:00.000')).toBe(true);
		expect(await emailService.repairBrevoEmailTime(c, row, '2026-07-15 08:00:00.000')).toBe(false);
		const actual = await env.db.prepare('SELECT * FROM email WHERE email_id = 1').first();
		expect(actual.create_time).toBe('2026-07-16 08:00:00.000');
		expect(actual.status).toBe(2);
		expect(actual.account_id).toBe(1);
		expect(await emailService.repairBrevoEmailTime(c, { ...row, createTime: actual.create_time }, actual.create_time)).toBe(false);
	});
	it('creates time indexes idempotently', async () => {
		await init.v3_9DB(c);
		await init.v3_9DB(c);
		const indexes = await env.db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_email_%'").all();
		expect(indexes.results.map(row => row.name)).toContain('idx_email_time_id');
	});
});
