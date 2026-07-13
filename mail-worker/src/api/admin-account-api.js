import app from '../hono/hono';
import accountService from '../service/account-service';
import result from '../model/result';

app.post('/admin/account/add', async (c) => {
	await accountService.addForUser(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/admin/account/rename', async (c) => {
	await accountService.renameByAdmin(c, await c.req.json());
	return c.json(result.ok());
});

app.delete('/admin/account/delete', async (c) => {
	await accountService.deleteByAdmin(c, c.req.query());
	return c.json(result.ok());
});