import { env } from 'cloudflare:test';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import email from '../src/entity/email';
import account from '../src/entity/account';
import { star } from '../src/entity/star';
import emailService from '../src/service/email-service';
import accountMemberService from '../src/service/account-member-service';

const context = { env };
const list = (params = {}) => emailService.list(context, {
  accountId: 1, allReceive: 0, size: 2, timeSort: 0, type: 0, ...params
}, 7);

beforeEach(async () => {
  for (const [name, table] of [['email', email], ['account', account], ['star', star]]) {
    await env.db.prepare(`CREATE TABLE ${name} (${Object.values(getTableColumns(table))
      .map(column => `"${column.name}" ${column.getSQLType()}`).join(', ')})`).run();
  }
  await env.db.prepare('INSERT INTO account (account_id, is_del) VALUES (1, 0), (2, 0), (3, 0), (4, 1)').run();
  const rows = [
    [1, 1, 'Invoice alpha', '', '', '', 0, 0],
    [2, 1, '', 'ALPHA sender', '', '', 0, 0],
    [3, 1, '', '', 'alpha@example.com', '', 0, 0],
    [4, 1, '', '', '', '中文 alpha body', 0, 0],
    [5, 2, 'alpha shared', '', '', '', 0, 0],
    [6, 3, 'alpha private', '', '', '', 0, 0],
    [7, 1, 'alpha deleted', '', '', '', 0, 1],
    [8, 1, 'alpha sent', '', '', '', 1, 0],
    [9, 4, 'alpha deleted account', '', '', '', 0, 0],
    [10, 1, '100%_\\ literal', '', '', '', 0, 0],
    [11, 1, 'unrelated', '', '', '', 0, 0],
  ];
  for (const row of rows) {
    await env.db.prepare(`INSERT INTO email
      (email_id, account_id, subject, name, send_email, text, type, is_del)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(...row).run();
  }
  vi.spyOn(accountMemberService, 'listAccessibleAccountIds').mockResolvedValue([1, 2, 4]);
  vi.spyOn(emailService, 'emailAddAtt').mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());

describe('inbox keyword search', () => {
  it('searches all four fields with a consistent count and cursor pagination', async () => {
    const first = await list({ keyword: ' ALPHA ' });
    expect(first.list.map(row => row.emailId)).toEqual([4, 3]);
    expect(first.total).toBe(4);
    const second = await list({ keyword: 'alpha', emailId: 3 });
    expect(second.list.map(row => row.emailId)).toEqual([2, 1]);
    expect(second.total).toBe(4);
    expect((await list({ keyword: 'alpha', timeSort: 1 })).list.map(row => row.emailId)).toEqual([1, 2]);
  });
  it('preserves mailbox access, shared scope, deletion and inbox boundaries', async () => {
    const result = await list({ keyword: 'alpha', allReceive: 1, size: 50 });
    expect(result.list.map(row => row.emailId)).toEqual([5, 4, 3, 2, 1]);
    expect(result.total).toBe(5);
    expect((await list({ keyword: 'alpha', accountId: 3 })).total).toBe(0);
  });
  it('handles literal wildcards, Chinese text, empty searches and no matches', async () => {
    expect((await list({ keyword: '%_\\' })).list.map(row => row.emailId)).toEqual([10]);
    expect((await list({ keyword: '中文' })).total).toBe(1);
    expect((await list({ keyword: '   ' })).total).toBe(6);
    const result = await list({ keyword: "' OR 1=1 --" });
    expect(result.list).toEqual([]);
    expect(result.total).toBe(0);
  });
});
