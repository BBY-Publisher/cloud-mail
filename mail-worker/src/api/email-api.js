import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import userContext from '../security/user-context';
import attService from '../service/att-service';
import resendService from '../service/resend-service';
import brevoService from '../service/brevo-service';

app.get('/email/list', async (c) => {
	const data = await emailService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.get('/email/latest', async (c) => {
	const list = await emailService.latest(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.delete('/email/delete', async (c) => {
	await emailService.delete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/email/attList', async (c) => {
	const attList = await attService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(attList));
});

app.post('/email/send', async (c) => {
	const email = await emailService.send(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(email));
});

app.put('/email/read', async (c) => {
	await emailService.read(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
})

app.post('/email/sync', async (c) => {
	const results = {};
	const allErrors = [];

	try {
		results.resend = await resendService.syncFromProvider(c);
		allErrors.push(...(results.resend.errors || []));
	} catch (e) {
		results.resend = { inserted: 0, skipped: 0, error: e?.message || String(e) };
		allErrors.push(`resend: ${e?.message || e}`);
	}

	try {
		results.brevo = await brevoService.syncFromProvider(c);
		allErrors.push(...(results.brevo.errors || []));
	} catch (e) {
		results.brevo = { inserted: 0, skipped: 0, error: e?.message || String(e) };
		allErrors.push(`brevo: ${e?.message || e}`);
	}

	const inserted = (results.resend?.inserted || 0) + (results.brevo?.inserted || 0);
	const skipped = (results.resend?.skipped || 0) + (results.brevo?.skipped || 0);

	return c.json(result.ok({ inserted, skipped, errors: allErrors, providers: results }));
});

