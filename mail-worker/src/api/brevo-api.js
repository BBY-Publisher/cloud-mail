import brevoService from '../service/brevo-service';
import app from '../hono/hono';

app.post('/webhooks/brevo', async (c) => {
	try {
		const rawPayload = await c.req.text();
		const body = JSON.parse(rawPayload || '{}');
		await brevoService.webhooks(c, {
			rawPayload,
			body,
			authorization: c.req.header('Authorization') || '',
			webhookSecret: c.req.header('X-Cloud-Mail-Webhook-Secret') || ''
		});
		return c.text('success', 200);
	} catch (e) {
		return c.text(e.message, e.code || 500);
	}
});
