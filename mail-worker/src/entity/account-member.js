import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const accountMember = sqliteTable('account_member', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	accountId: integer('account_id').notNull(),
	userId: integer('user_id').notNull(),
	role: integer('role').notNull().default(1),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`),
	updateTime: text('update_time').default(sql`CURRENT_TIMESTAMP`),
});

export default accountMember;