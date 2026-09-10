import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm';
import email from '../entity/email';
import orm from '../entity/orm';
import BizError from '../error/biz-error';

// julianday compares legacy SQLite UTC strings and provider ISO offsets equally.
export const emailSortTime = sql`coalesce(julianday(${email.createTime}), 0)`;

export async function emailTimePagination(c, { emailId, cursorTime, timeSort }) {
	const ascending = Number(timeSort) === 1;
	const order = ascending ? asc : desc;
	const compare = ascending ? gt : lt;
	const id = Number(emailId || 0);
	if (!Number.isSafeInteger(id) || id < 0) throw new BizError('Invalid email cursor', 400);
	let condition;
	if (id) {
		// Older clients can still use an ID while the cursor row exists.
		if (cursorTime === undefined) {
			const row = await orm(c).select({ createTime: email.createTime }).from(email).where(eq(email.emailId, id)).get();
			if (!row) throw new BizError('Email cursor expired; refresh the list', 400);
			cursorTime = row.createTime || '';
		}
		if (typeof cursorTime !== 'string' || cursorTime.length > 40) throw new BizError('Invalid email cursor time', 400);
		const time = sql`coalesce(julianday(${cursorTime}), 0)`;
		condition = or(compare(emailSortTime, time), and(eq(emailSortTime, time), compare(email.emailId, id)));
	}
	return { condition, order: [order(emailSortTime), order(email.emailId)] };
}
