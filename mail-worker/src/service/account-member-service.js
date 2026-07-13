import BizError from '../error/biz-error';
import orm from '../entity/orm';
import account from '../entity/account';
import accountMember from '../entity/account-member';
import userEntity from '../entity/user';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { accountMemberConst, isDel } from '../const/entity-const';
import { t } from '../i18n/i18n';

const ROLE = {
	[accountMemberConst.role.VIEWER]: 'viewer',
	[accountMemberConst.role.SENDER]: 'sender',
	[accountMemberConst.role.ADMIN]: 'admin',
};

const ROLE_FROM_STRING = {
	viewer: accountMemberConst.role.VIEWER,
	sender: accountMemberConst.role.SENDER,
	admin: accountMemberConst.role.ADMIN,
};

const accountMemberService = {

	async getAccountPerm(c, accountId, userId) {

		const accountRow = await orm(c)
			.select({ userId: account.userId })
			.from(account)
			.where(and(eq(account.accountId, accountId), eq(account.isDel, isDel.NORMAL)))
			.get();

		if (!accountRow) return null;
		if (accountRow.userId === userId) return 'owner';

		const memberRow = await orm(c)
			.select({ role: accountMember.role })
			.from(accountMember)
			.where(and(eq(accountMember.accountId, accountId), eq(accountMember.userId, userId)))
			.get();

		if (!memberRow) return null;
		return ROLE[memberRow.role] || null;
	},

	async listAccessibleAccountIds(c, userId) {

		const ownedRows = await orm(c)
			.select({ accountId: account.accountId })
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.isDel, isDel.NORMAL)))
			.all();

		const memberRows = await orm(c)
			.select({ accountId: accountMember.accountId })
			.from(accountMember)
			.where(eq(accountMember.userId, userId))
			.all();

		const ids = new Set();
		for (const r of ownedRows) ids.add(r.accountId);
		for (const r of memberRows) ids.add(r.accountId);
		return Array.from(ids);
	},

	async listAccessibleAccounts(c, userId, params) {

		let { size, lastSort } = params || {};
		size = Math.min(Number(size) || 30, 30);
		lastSort = Number(lastSort);
		if (Number.isNaN(lastSort)) lastSort = 9999999999;

		const accessibleIds = await this.listAccessibleAccountIds(c, userId);

		if (accessibleIds.length === 0) {
			return [];
		}

		const memberMap = await this.getMemberMapForAccounts(c, accessibleIds);

		const ownedRows = await orm(c)
			.select({
				accountId: account.accountId,
				email: account.email,
				name: account.name,
				userId: account.userId,
				status: account.status,
				allReceive: account.allReceive,
				sort: account.sort,
				ownerEmail: userEntity.email,
			})
			.from(account)
			.leftJoin(userEntity, eq(userEntity.userId, account.userId))
			.where(and(
				inArray(account.accountId, accessibleIds),
				eq(account.isDel, isDel.NORMAL),
				sql`(${account.sort} < ${lastSort} OR (${account.sort} = ${lastSort}))`,
			))
			.orderBy(sql`${account.sort} DESC, ${account.accountId} ASC`)
			.limit(size)
			.all();

		return ownedRows.map(row => ({
			...row,
			perm: row.userId === userId ? 'owner' : (ROLE[memberMap.get(row.accountId)] || null),
			memberCount: 0,
		}));
	},

	async getMemberMapForAccounts(c, accountIds) {

		if (!accountIds || accountIds.length === 0) return new Map();

		const rows = await orm(c)
			.select({ accountId: accountMember.accountId, role: accountMember.role })
			.from(accountMember)
			.where(inArray(accountMember.accountId, accountIds))
			.all();

		const m = new Map();
		for (const r of rows) {
			m.set(r.accountId, r.role);
		}
		return m;
	},

	async can(c, accountId, userId, op) {

		const perm = await this.getAccountPerm(c, accountId, userId);
		if (!perm) return false;

		switch (op) {
			case 'read':
				return true;
			case 'send':
				return perm === 'owner' || perm === 'sender' || perm === 'admin';
			case 'rename':
				return perm === 'owner' || perm === 'admin';
			case 'setAllReceive':
				return perm === 'owner' || perm === 'admin';
			case 'manage_members':
				return perm === 'owner' || perm === 'admin';
			case 'delete_account':
				return perm === 'owner';
			case 'delete_email':
				return perm === 'owner';
			default:
				return false;
		}
	},

	async addMember(c, accountId, targetEmail, role, actingUserId) {

		const accountRow = await orm(c)
			.select()
			.from(account)
			.where(and(eq(account.accountId, accountId), eq(account.isDel, isDel.NORMAL)))
			.get();

		if (!accountRow) {
			throw new BizError(t('senderAccountNotExist'), 404);
		}

		const canManage = await this.can(c, accountId, actingUserId, 'manage_members');
		if (!canManage) {
			throw new BizError(t('notAccountOwnerOrAdmin'), 403);
		}

		const targetUser = await orm(c)
			.select()
			.from(userEntity)
			.where(sql`${userEntity.email} COLLATE NOCASE = ${targetEmail}`)
			.get();

		if (!targetUser || targetUser.isDel === isDel.DELETE) {
			throw new BizError(t('memberNotExist'), 404);
		}

		if (targetUser.userId === actingUserId) {
			throw new BizError(t('cannotAddSelfAsMember'), 400);
		}

		if (targetUser.userId === accountRow.userId) {
			throw new BizError(t('cannotShareOwner'), 400);
		}

		const ownerUser = await orm(c)
			.select({ email: userEntity.email })
			.from(userEntity)
			.where(eq(userEntity.userId, accountRow.userId))
			.get();

		if (ownerUser && ownerUser.email && ownerUser.email.toLowerCase() === accountRow.email.toLowerCase()) {
			throw new BizError(t('memberSelfAccount'), 400);
		}

		const numericRole = typeof role === 'string' ? ROLE_FROM_STRING[role] : role;
		if (!numericRole) {
			throw new BizError(t('memberRoleInvalid'), 400);
		}

		const existing = await orm(c)
			.select()
			.from(accountMember)
			.where(and(eq(accountMember.accountId, accountId), eq(accountMember.userId, targetUser.userId)))
			.get();

		if (existing) {
			await orm(c)
				.update(accountMember)
				.set({ role: numericRole, updateTime: sql`CURRENT_TIMESTAMP` })
				.where(eq(accountMember.id, existing.id))
				.run();
		} else {
			await orm(c)
				.insert(accountMember)
				.values({ accountId, userId: targetUser.userId, role: numericRole })
				.run();
		}
	},

	async removeMember(c, accountId, targetUserId, actingUserId) {

		const isSelf = targetUserId === actingUserId;
		if (!isSelf) {
			const canManage = await this.can(c, accountId, actingUserId, 'manage_members');
			if (!canManage) {
				throw new BizError(t('notAccountOwnerOrAdmin'), 403);
			}
		}

		await orm(c)
			.delete(accountMember)
			.where(and(eq(accountMember.accountId, accountId), eq(accountMember.userId, targetUserId)))
			.run();
	},

	async setMemberRole(c, accountId, targetUserId, role, actingUserId) {

		const canManage = await this.can(c, accountId, actingUserId, 'manage_members');
		if (!canManage) {
			throw new BizError(t('notAccountOwnerOrAdmin'), 403);
		}

		const numericRole = typeof role === 'string' ? ROLE_FROM_STRING[role] : role;
		if (!numericRole) {
			throw new BizError(t('memberRoleInvalid'), 400);
		}

		await orm(c)
			.update(accountMember)
			.set({ role: numericRole, updateTime: sql`CURRENT_TIMESTAMP` })
			.where(and(eq(accountMember.accountId, accountId), eq(accountMember.userId, targetUserId)))
			.run();
	},

	async listMembers(c, accountId, actingUserId) {

		const perm = await this.getAccountPerm(c, accountId, actingUserId);
		if (!perm) {
			throw new BizError(t('noUserAccount'), 403);
		}

		const rows = await orm(c)
			.select({
				userId: accountMember.userId,
				role: accountMember.role,
				createTime: accountMember.createTime,
				email: userEntity.email,
				status: userEntity.status,
				isDel: userEntity.isDel,
			})
			.from(accountMember)
			.leftJoin(userEntity, eq(userEntity.userId, accountMember.userId))
			.where(eq(accountMember.accountId, accountId))
			.all();

		return rows.map(r => ({
			userId: r.userId,
			email: r.email,
			role: ROLE[r.role] || 'viewer',
			roleValue: r.role,
			status: r.status,
			isDel: r.isDel,
			createTime: r.createTime,
		}));
	},

	async countMembersForAccounts(c, accountIds) {

		if (!accountIds || accountIds.length === 0) return new Map();

		const rows = await orm(c)
			.select({ accountId: accountMember.accountId, count: sql`COUNT(*)` })
			.from(accountMember)
			.where(inArray(accountMember.accountId, accountIds))
			.groupBy(accountMember.accountId)
			.all();

		const m = new Map();
		for (const r of rows) m.set(r.accountId, r.count);
		return m;
	},

	async physicsDeleteByAccountId(c, accountId) {
		await orm(c)
			.delete(accountMember)
			.where(eq(accountMember.accountId, accountId))
			.run();
	},

	async physicsDeleteByUserIds(c, userIds) {

		if (!userIds || userIds.length === 0) return;

		await orm(c)
			.delete(accountMember)
			.where(inArray(accountMember.userId, userIds))
			.run();

		const ownedAccountIds = await orm(c)
			.select({ accountId: account.accountId })
			.from(account)
			.where(inArray(account.userId, userIds))
			.all();

		if (ownedAccountIds.length > 0) {
			const ids = ownedAccountIds.map(r => r.accountId);
			await orm(c)
				.delete(accountMember)
				.where(inArray(accountMember.accountId, ids))
				.run();
		}
	},
};

export default accountMemberService;