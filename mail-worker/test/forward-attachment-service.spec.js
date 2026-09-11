import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { att } from '../src/entity/att';
import email from '../src/entity/email';
import forwardAttachmentService from '../src/service/forward-attachment-service';
import accountMemberService from '../src/service/account-member-service';
import r2Service from '../src/service/r2-service';
import emailService from '../src/service/email-service';
import settingService from '../src/service/setting-service';
import userService from '../src/service/user-service';
import roleService from '../src/service/role-service';
import accountService from '../src/service/account-service';
import { toForwardAttachments } from '../../mail-vue/src/utils/forward-attachments';
import { MAX_ATTACHMENT_UPLOAD_SIZE } from '../src/const/attachment-const';

const uploadKey = 'attachments/11111111-1111-4111-8111-111111111111.pdf';
const legacyKey = 'attachments/0123456789abcdef0123456789abcdef.pdf';
let c;
let objects;

async function insertAttachment(id, key, options = {}) {
	await env.db.prepare(`INSERT INTO attachments
		(att_id, email_id, account_id, user_id, key, filename, mime_type, size, type, content_id)
		VALUES (?, 1, 9, 99, ?, 'report.pdf', 'application/pdf', 4, ?, ?)`)
		.bind(id, key, options.type || 0, options.contentId || null).run();
}

beforeEach(async () => {
	for (const [name, table] of [['attachments', att], ['email', email]]) {
		await env.db.prepare(`CREATE TABLE ${name} (${Object.values(getTableColumns(table))
			.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY AUTOINCREMENT' : ''}`)
			.join(', ')})`).run();
	}
	await env.db.prepare('INSERT INTO email (email_id, account_id, user_id, is_del) VALUES (1, 9, 99, 0)').run();
	objects = new Map();
	const get = vi.fn(async key => {
		const object = objects.get(key);
		return object ? { ...object, arrayBuffer: async () => object.content } : null;
	});
	c = { req: { url: 'https://mail.example.com/api/email/send' }, env: { ...env, r2: {
		get, head: get,
		put: vi.fn(async (key, content, metadata) => {
			objects.set(key, { size: content.byteLength, content, ...metadata });
		})
	} } };
	vi.spyOn(accountMemberService, 'can').mockResolvedValue(true);
	vi.spyOn(r2Service, 'storageType').mockResolvedValue('R2');
});
afterEach(() => vi.restoreAllMocks());

const resolve = (attachments, options) => forwardAttachmentService.resolve(c, attachments, 7, options);
const reference = attId => ({ storageType: 'existing', attId });

function setupSend() {
	vi.spyOn(settingService, 'query').mockResolvedValue({ resendTokens: { 'example.com': 'test' },
		domainProviders: {}, domainList: ['@example.com'], r2Domain: '', send: 0 });
	vi.spyOn(settingService, 'isAdmin').mockReturnValue(false);
	vi.spyOn(userService, 'selectById').mockResolvedValue({ userId: 7, email: 'user@example.com' });
	vi.spyOn(roleService, 'selectById').mockResolvedValue({ sendCount: 0 });
	vi.spyOn(roleService, 'hasAvailDomainPerm').mockReturnValue(true);
	vi.spyOn(accountService, 'selectById').mockResolvedValue({ accountId: 2, userId: 7, email: 'user@example.com' });
	return vi.spyOn(emailService, 'sendByResend').mockResolvedValue({ data: { id: 'sent' } });
}

describe('forward attachments', () => {
	it('keeps attachment-list files with Content-ID when composing and excludes EMBED rows', () => {
		const source = [{ attId: 1, filename: 'report.pdf', size: 4 },
			{ attId: 2, filename: 'video.mp4', size: 4, type: 0, contentId: '<file-cid>' }, { attId: 3, type: 1 }];
		const selected = toForwardAttachments(source);
		expect(selected).toEqual([
			{ storageType: 'existing', attId: 1, filename: 'report.pdf', size: 4 },
			{ storageType: 'existing', attId: 2, filename: 'video.mp4', size: 4 }
		]);
		selected.splice(0, 1);
		expect(source).toHaveLength(3);
		expect(toForwardAttachments()).toEqual([]);
	});

	it('copies original KV bytes into R2 and returns a downloadable upload reference', async () => {
		await insertAttachment(1, legacyKey);
		await env.kv.put(legacyKey, 'test');
		const [result] = await resolve([reference(1)]);
		expect(result).toMatchObject({ storageType: 'R2', filename: 'report.pdf', size: 4 });
		expect(result.url).toBe(`https://mail.example.com/api/oss/${result.key}`);
		expect(new TextDecoder().decode(objects.get(result.key).content)).toBe('test');
		expect(await env.kv.get(legacyKey)).toBe('test');
		expect(accountMemberService.can).toHaveBeenCalledWith(c, 9, 7, 'read');
	});

	it('reuses an existing R2 upload without copying its bytes', async () => {
		await insertAttachment(1, uploadKey);
		objects.set(uploadKey, { size: 4, content: new TextEncoder().encode('test').buffer });
		expect((await resolve([reference(1)]))[0].key).toBe(uploadKey);
		expect(c.env.r2.put).not.toHaveBeenCalled();
	});

	it('copies legacy R2 and S3 objects into the upload namespace', async () => {
		await insertAttachment(1, legacyKey);
		objects.set(legacyKey, { size: 4, content: new TextEncoder().encode('test').buffer });
		const [first] = await resolve([reference(1)]);
		expect(first.key).not.toBe(legacyKey);
		objects.clear();
		vi.mocked(r2Service.storageType).mockResolvedValue('S3');
		vi.spyOn(r2Service, 'getObj').mockResolvedValue(new Response('test'));
		const [second] = await resolve([reference(1)]);
		expect(objects.get(second.key).size).toBe(4);
	});

	it('retains an external URL without fetching it or requiring R2', async () => {
		await insertAttachment(1, 'https://files.example.org/report.pdf');
		c.env.r2 = undefined;
		expect(await resolve([reference(1)])).toEqual([{
			storageType: 'external', url: 'https://files.example.org/report.pdf',
			filename: 'report.pdf', contentType: 'application/pdf', size: 4
		}]);
	});

	it('recognizes our own download URLs as stored files instead of external links', async () => {
		await insertAttachment(1, `https://mail.example.com/api/oss/${legacyKey}`);
		await insertAttachment(2, `https://cdn.example.com/${legacyKey}`);
		await env.kv.put(legacyKey, 'test');
		const results = await resolve([reference(1), reference(2)], { r2Domain: 'cdn.example.com' });
		expect(results.every(item => item.storageType === 'R2')).toBe(true);
	});

	it('rejects inaccessible, missing and inline attachment references before storage access', async () => {
		await insertAttachment(1, legacyKey);
		await insertAttachment(2, legacyKey, { contentId: 'inline', type: 1 });
		vi.mocked(accountMemberService.can).mockResolvedValue(false);
		await expect(resolve([reference(1)])).rejects.toThrow('not accessible');
		await expect(resolve([reference(99)])).rejects.toThrow('unavailable');
		await expect(resolve([reference(2)])).rejects.toThrow('unavailable');
		await expect(resolve([reference('1')])).rejects.toThrow('Invalid source');
		expect(c.env.r2.get).not.toHaveBeenCalled();
	});

	it('allows administrator forwarding of unassigned mail but rejects deleted mail for regular users', async () => {
		await insertAttachment(1, 'https://files.example.org/report.pdf');
		await env.db.prepare('UPDATE email SET account_id = 0, is_del = 1').run();
		await expect(resolve([reference(1)])).rejects.toThrow('not accessible');
		expect(await resolve([reference(1)], { isAdmin: true })).toHaveLength(1);
	});

	it('fails instead of silently dropping missing, oversized or unwritable attachments', async () => {
		await insertAttachment(1, uploadKey);
		await expect(resolve([reference(1)])).rejects.toThrow('file is missing');
		objects.set(uploadKey, { size: MAX_ATTACHMENT_UPLOAD_SIZE + 1 });
		await expect(resolve([reference(1)])).rejects.toThrow('exceeds 64 MiB');
		objects.clear();
		await env.kv.put(uploadKey, 'test');
		vi.mocked(c.env.r2.put).mockRejectedValue(new Error('R2 unavailable'));
		await expect(resolve([reference(1)])).rejects.toThrow('R2 unavailable');
	});

	it('stores newly added base64 files in R2 during forwarding', async () => {
		const [result] = await resolve([{ filename: 'notes.txt', content: 'dGVzdA==' }]);
		expect(result.storageType).toBe('R2');
		expect(new TextDecoder().decode(objects.get(result.key).content)).toBe('test');
	});

	it.each(['forward', 'reply'])('%s sends Content-ID files and external links, persists them, and supports composing again', async sendType => {
		await insertAttachment(1, legacyKey, { contentId: '<file-cid>' });
		await insertAttachment(2, 'https://files.example.org/report.pdf');
		await env.kv.put(legacyKey, 'test');
		const send = setupSend();
		const [sent] = await emailService.send(c, { accountId: 2, receiveEmail: ['recipient@outside.test'],
			sendType, emailId: 1, subject: 'Forward', content: '<p>Original body</p>', text: 'Original body',
			includeSignature: false, attachments: [reference(1), reference(2)] }, 7);
		const request = send.mock.calls[0][1];
		expect(request.attachments).toEqual([]);
		expect(request.html).toContain('https://mail.example.com/api/oss/attachments/');
		expect(request.html).toContain('https://files.example.org/report.pdf');
		expect(request.text).toContain('https://files.example.org/report.pdf');
		expect(sent.attList).toHaveLength(2);
		const again = await resolve(toForwardAttachments(sent.attList));
		expect(again.map(item => item.storageType)).toEqual(['R2', 'external']);
	});

	it('does not call the provider or create sent mail when R2 persistence fails', async () => {
		await insertAttachment(1, legacyKey);
		await env.kv.put(legacyKey, 'test');
		const send = setupSend();
		vi.mocked(c.env.r2.put).mockRejectedValue(new Error('R2 unavailable'));
		await expect(emailService.send(c, { accountId: 2, receiveEmail: ['recipient@outside.test'],
			sendType: 'forward', subject: 'Forward', content: '<p>Body</p>', includeSignature: false,
			attachments: [reference(1)] }, 7)).rejects.toThrow('R2 unavailable');
		expect(send).not.toHaveBeenCalled();
		expect((await env.db.prepare('SELECT COUNT(*) AS total FROM email').first()).total).toBe(1);
	});

	it('does not allow source references to bypass validation in a new message', async () => {
		const send = setupSend();
		await expect(emailService.send(c, { sendType: '', attachments: [reference(1)] }, 7))
			.rejects.toThrow('Invalid attachment');
		expect(send).not.toHaveBeenCalled();
		expect(c.env.r2.get).not.toHaveBeenCalled();
	});

});
