import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';

app.get('/allEmail/list', async (c) => {
	const data = await emailService.allList(c, c.req.query());
	return c.json(result.ok(data));
})

app.get('/allEmail/get', async (c) => {
	const id = Number(c.req.query('id'));
	if (!id) {
		throw new BizError(t('notExistEmailReply'), 400);
	}
	const row = await emailService.selectById(c, id);
	if (!row) {
		throw new BizError(t('notExistEmailReply'), 404);
	}
	return c.json(result.ok(row));
})

app.delete('/allEmail/delete', async (c) => {
	const list = await emailService.physicsDelete(c, c.req.query());
	return c.json(result.ok(list));
})

app.delete('/allEmail/batchDelete', async (c) => {
	await emailService.batchDelete(c, c.req.query());
	return c.json(result.ok());
})

app.get('/allEmail/latest', async (c) => {
	const list = await emailService.allEmailLatest(c, c.req.query());
	return c.json(result.ok(list));
})
