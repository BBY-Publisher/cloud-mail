import resendService from '../service/resend-service';
import app from '../hono/hono';
app.post('/webhooks',async (c) => {
	try {
		const payload = await c.req.text();
		await resendService.webhooks(c, {
			payload,
			headers: {
				id: c.req.header('svix-id'),
				timestamp: c.req.header('svix-timestamp'),
				signature: c.req.header('svix-signature')
			}
		});
		return c.text('success', 200)
	} catch (e) {
		return c.text(e.message, e.code || 500)
	}
})
