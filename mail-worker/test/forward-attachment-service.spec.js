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
import attService from '../src/service/att-service';

const uploadKey = 'attachments/11111111-1111-4111-8111-111111111111.pdf';
const legacyKey = 'attachments/0123456789abcdef0123456789abcdef.pdf';
let c;
let objectIo;

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
	const noObjectAccess = () => vi.fn(async () => { throw new Error('Unexpected object access'); });
	objectIo = { get: noObjectAccess(), head: noObjectAccess(), put: noObjectAccess(),
		kvGet: noObjectAccess(), storageGet: noObjectAccess(), storagePut: noObjectAccess() };
	c = { req: { url: 'https://mail.example.com/api/email/send' }, env: { ...env,
		r2: { get: objectIo.get, head: objectIo.head, put: objectIo.put },
		kv: { get: env.kv.get.bind(env.kv), put: env.kv.put.bind(env.kv), getWithMetadata: objectIo.kvGet }
	} };
	vi.spyOn(r2Service, 'getObj').mockImplementation(objectIo.storageGet);
	vi.spyOn(r2Service, 'putObj').mockImplementation(objectIo.storagePut);
	vi.spyOn(accountMemberService, 'can').mockResolvedValue(true);
	vi.spyOn(r2Service, 'storageType').mockResolvedValue('R2');
});
afterEach(() => {
	for (const method of Object.values(objectIo)) expect(method).not.toHaveBeenCalled();
	vi.restoreAllMocks();
});

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

	it.each(['KV', 'R2', 'S3'])('reuses the original %s key and URL without object I/O or an R2 binding', async storageType => {
		await insertAttachment(1, legacyKey);
		vi.mocked(r2Service.storageType).mockResolvedValue(storageType);
		c.env.r2 = undefined;
		const [result] = await resolve([reference(1)]);
		expect(result).toEqual({ storageType: 'reference', key: legacyKey,
			url: `https://mail.example.com/api/oss/${legacyKey}`, filename: 'report.pdf',
			contentType: 'application/pdf', size: 4 });
		expect(accountMemberService.can).toHaveBeenCalledWith(c, 9, 7, 'read');
	});

	it('uses the configured public attachment domain and reuses UUID upload keys', async () => {
		await insertAttachment(1, uploadKey);
		const [result] = await resolve([reference(1)], { r2Domain: 'assets.example.com' });
		expect(result.key).toBe(uploadKey);
		expect(result.url).toBe(`https://assets.example.com/${uploadKey}`);
	});

	it.each(['https://files.example.org/report.pdf', `https://mail.example.com/api/oss/${legacyKey}`])(
		'preserves an original absolute URL: %s', async url => {
			await insertAttachment(1, url);
			c.env.r2 = undefined;
			expect(await resolve([reference(1)])).toEqual([{
				storageType: 'reference', key: url, url,
				filename: 'report.pdf', contentType: 'application/pdf', size: 4
			}]);
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

	it('leaves newly selected files on the normal upload/send path', async () => {
		const files = [{ filename: 'notes.txt', content: 'dGVzdA==' },
			{ storageType: 'R2', key: uploadKey, url: `https://mail.example.com/api/oss/${uploadKey}` }];
		expect(await resolve(files)).toEqual(files);
	});

	it('rejects unsafe stored keys instead of producing unsafe download links', async () => {
		await insertAttachment(1, 'javascript:alert(1)');
		await insertAttachment(2, 'attachments/../private');
		await expect(resolve([reference(1)])).rejects.toThrow('Invalid source attachment key');
		await expect(resolve([reference(2)])).rejects.toThrow('Invalid source attachment key');
	});

	it.each(['forward', 'reply'])('%s sends Content-ID files and external links, persists them, and supports composing again', async sendType => {
		await insertAttachment(1, legacyKey, { contentId: '<file-cid>' });
		await insertAttachment(2, 'https://files.example.org/report.pdf');
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
		expect(again.map(item => item.key)).toEqual([legacyKey, 'https://files.example.org/report.pdf']);
		expect(sent.attList.map(item => item.key)).toEqual([legacyKey, 'https://files.example.org/report.pdf']);
	});

	it('keeps the shared file when deleting the source and removes it only after its final reference', async () => {
		await insertAttachment(1, legacyKey);
		setupSend();
		const [sent] = await emailService.send(c, { accountId: 2, receiveEmail: ['recipient@outside.test'],
			sendType: 'forward', subject: 'Forward', content: '<p>Body</p>', includeSignature: false,
			attachments: [reference(1)] }, 7);
		const removeObject = vi.spyOn(r2Service, 'delete').mockResolvedValue();
		await attService.removeByEmailIds(c, [1]);
		expect(removeObject).not.toHaveBeenCalled();
		expect((await resolve(toForwardAttachments(sent.attList)))[0].key).toBe(legacyKey);
		await attService.removeByEmailIds(c, [sent.emailId]);
		expect(removeObject).toHaveBeenCalledExactlyOnceWith(c, [legacyKey]);
	});

	it('rejects client-forged resolved keys even with otherwise valid attachment content', async () => {
		const send = setupSend();
		await expect(emailService.send(c, { sendType: 'forward', attachments: [{ storageType: 'reference',
			key: legacyKey, url: `https://mail.example.com/api/oss/${legacyKey}`,
			filename: 'report.pdf', content: 'dGVzdA==' }] }, 7)).rejects.toThrow('Invalid attachment');
		expect(send).not.toHaveBeenCalled();
	});

	it('does not allow source references to bypass validation in a new message', async () => {
		const send = setupSend();
		await expect(emailService.send(c, { sendType: '', attachments: [reference(1)] }, 7))
			.rejects.toThrow('Invalid attachment');
		expect(send).not.toHaveBeenCalled();
		expect(c.env.r2.get).not.toHaveBeenCalled();
	});

});
