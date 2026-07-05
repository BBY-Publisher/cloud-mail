import app from '../hono/hono';
import result from '../model/result';
import signatureService from '../service/signature-service';

app.get('/signature/list', async (c) => {
	const list = await signatureService.list(c);
	return c.json(result.ok(list));
});

app.get('/signature/get', async (c) => {
	const data = await signatureService.getByEmail(c, c.req.query());
	return c.json(result.ok(data));
});

app.put('/signature/set', async (c) => {
	const row = await signatureService.set(c, await c.req.json());
	return c.json(result.ok(row));
});
