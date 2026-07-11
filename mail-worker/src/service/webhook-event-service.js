import dayjs from 'dayjs';
import { and, desc, eq, lte, count } from 'drizzle-orm';
import orm from '../entity/orm';
import webhookEvent from '../entity/webhook-event';

const RETENTION_DAYS = 30;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const webhookEventService = {

	async record(c, params) {
		try {
			const cutoff = dayjs().subtract(RETENTION_DAYS, 'day').toISOString();
			await orm(c).delete(webhookEvent)
				.where(and(lte(webhookEvent.createTime, cutoff), eq(webhookEvent.isDel, 0)))
				.run();
		} catch (_) {
			// retention prune is best-effort; never block the insert
		}

		let payloadText = '';
		try {
			payloadText = JSON.stringify(params.payload || {});
		} catch (_) {
			payloadText = JSON.stringify({ _unserializable: true });
		}

		return orm(c).insert(webhookEvent).values({
			provider: String(params.provider || ''),
			eventType: String(params.eventType || ''),
			resendEmailId: params.resendEmailId || null,
			messageId: params.messageId || null,
			status: typeof params.status === 'number' ? params.status : null,
			emailId: params.emailId || null,
			recipient: params.recipient || null,
			reason: params.reason || null,
			payload: payloadText
		}).returning().get();
	},

	async selectList(c, params) {
		const num = Math.max(1, Number(params.num) || 1);
		const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.size) || DEFAULT_PAGE_SIZE));
		const offset = (num - 1) * size;
		const provider = params.provider;

		const conditions = [eq(webhookEvent.isDel, 0)];
		if (provider) {
			conditions.push(eq(webhookEvent.provider, provider));
		}

		const where = and(...conditions);

		const [list, totalRow] = await Promise.all([
			orm(c).select().from(webhookEvent).where(where)
				.orderBy(desc(webhookEvent.createTime))
				.limit(size).offset(offset).all(),
			orm(c).select({ total: count() }).from(webhookEvent).where(where).get()
		]);

		return { list, total: totalRow?.total || 0 };
	},

	async clear(c) {
		return orm(c).update(webhookEvent).set({ isDel: 1 }).run();
	}
};

export default webhookEventService;