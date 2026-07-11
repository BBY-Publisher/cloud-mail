import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const webhookEvent = sqliteTable('webhook_event', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	provider: text('provider').notNull(),
	eventType: text('event_type').notNull(),
	resendEmailId: text('resend_email_id'),
	messageId: text('message_id'),
	status: integer('status'),
	emailId: integer('email_id'),
	recipient: text('recipient'),
	reason: text('reason'),
	payload: text('payload').notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	isDel: integer('is_del').default(0).notNull()
});

export default webhookEvent;