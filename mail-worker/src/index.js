import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
import { Hono } from 'hono';

const apiApp = new Hono();
apiApp.route('/api', app);

export async function dispatchRequest(
	req,
	env,
	ctx,
	apiFetch = (request, bindings, executionContext) =>
		apiApp.fetch(request, bindings, executionContext)
) {
	const url = new URL(req.url);

	if (url.pathname.startsWith('/api/')) {
		return apiFetch(req, env, ctx);
	}

	if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
		return await kvObjService.toObjResp({ env }, url.pathname.substring(1));
	}

	return env.assets.fetch(req);
}

export default {
	async fetch(req, env, ctx) {
		return dispatchRequest(req, env, ctx);
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};
