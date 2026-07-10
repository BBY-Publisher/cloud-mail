import brevoService from '../service/brevo-service';
import app from '../hono/hono';

app.post('/webhooks/brevo', async (c) => {
	try {
		const rawPayload = await c.req.text();
		const body = JSON.parse(rawPayload || '{}');
		const signature = c.req.header('X-Brevo-Signature') || '';
		await brevoService.webhooks(c, { rawPayload, body, signature });
		return c.text('success', 200);
	} catch (e) {
		return c.text(e.message, e.code || 500);
	}
});