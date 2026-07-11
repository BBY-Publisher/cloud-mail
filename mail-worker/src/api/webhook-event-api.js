import app from '../hono/hono';
import result from '../model/result';
import webhookEventService from '../service/webhook-event-service';

app.get('/webhookEvent/list', async (c) => {
	const data = await webhookEventService.selectList(c, c.req.query());
	return c.json(result.ok(data));
});

app.delete('/webhookEvent/clear', async (c) => {
	await webhookEventService.clear(c);
	return c.json(result.ok());
});