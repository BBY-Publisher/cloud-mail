import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const signature = sqliteTable('signature', {
	signatureId: integer('signature_id').primaryKey({ autoIncrement: true }),
	domain: text('domain').notNull(),
	content: text('content').default('').notNull(),
	enabled: integer('enabled').default(1).notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	updateTime: text('update_time').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export default signature
