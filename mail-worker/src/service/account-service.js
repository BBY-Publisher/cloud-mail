import BizError from '../error/biz-error';
import verifyUtils from '../utils/verify-utils';
import emailUtils from '../utils/email-utils';
import userService from './user-service';
import emailService from './email-service';
import accountMemberService from './account-member-service';
import orm from '../entity/orm';
import account from '../entity/account';
import userEntity from '../entity/user';
import { and, asc, eq, gt, inArray, count, sql, ne, or, lt, desc } from 'drizzle-orm';
import {accountConst, isDel, settingConst} from '../const/entity-const';
import settingService from './setting-service';
import turnstileService from './turnstile-service';
import roleService from './role-service';
import { t } from '../i18n/i18n';
import verifyRecordService from './verify-record-service';

const accountService = {

	async add(c, params, userId) {

		const { addEmailVerify , addEmail, manyEmail, addVerifyCount, minEmailPrefix, emailPrefixFilter, domainList, adminEmail } = await settingService.query(c);

		let { email, token } = params;


		if (!(addEmail === settingConst.addEmail.OPEN && manyEmail === settingConst.manyEmail.OPEN)) {
			throw new BizError(t('addAccountDisabled'));
		}


		if (!email) {
			throw new BizError(t('emptyEmail'));
		}

		if (!verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		if (!domainList.includes('@' + emailUtils.getDomain(email))) {
			throw new BizError(t('notExistDomain'));
		}

		if (emailUtils.getName(email).length < minEmailPrefix) {
			throw new BizError(t('minEmailPrefix', { msg: minEmailPrefix } ));
		}

		if (emailPrefixFilter.some(content => emailUtils.getName(email).includes(content))) {
			throw new BizError(t('banEmailPrefix'));
		}

		let accountRow = await this.selectByEmailIncludeDel(c, email);

		if (accountRow && accountRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelAccount'));
		}

		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		const userRow = await userService.selectById(c, userId);
		const roleRow = await roleService.selectById(c, userRow.type);

		if (userRow.email !== adminEmail) {

			if (roleRow.accountCount > 0) {
				const userAccountCount = await accountService.countUserAccount(c, userId)
				if(userAccountCount >= roleRow.accountCount) throw new BizError(t('accountLimit'), 403);
			}

			if(!roleService.hasAvailDomainPerm(roleRow.availDomain, email)) {
				throw new BizError(t('noDomainPermAdd'),403)
			}

		}

		let addVerifyOpen = false

		if (addEmailVerify === settingConst.addEmailVerify.OPEN) {
			addVerifyOpen = true
			await turnstileService.verify(c, token);
		}

		if (addEmailVerify === settingConst.addEmailVerify.COUNT) {
			addVerifyOpen = await verifyRecordService.isOpenAddVerify(c, addVerifyCount);
			if (addVerifyOpen) {
				await turnstileService.verify(c,token)
			}
		}


		accountRow = await orm(c).insert(account).values({ email: email, userId: userId, name: emailUtils.getName(email) }).returning().get();

		if (addEmailVerify === settingConst.addEmailVerify.COUNT && !addVerifyOpen) {
			const row = await verifyRecordService.increaseAddCount(c);
			addVerifyOpen = row.count >= addVerifyCount
		}

		accountRow.addVerifyOpen = addVerifyOpen
		return accountRow;
	},

	selectByEmailIncludeDel(c, email) {
		return orm(c).select().from(account).where(sql`${account.email} COLLATE NOCASE = ${email}`).get();
	},

	async list(c, params, userId) {

		let { accountId, size, lastSort } = params;

		accountId = Number(accountId);
		size = Number(size);
		lastSort = Number(lastSort);

		if (size > 30) {
			size = 30;
		}

		if (!accountId) {
			accountId = 0;
		}

		if(Number.isNaN(lastSort)) {
			lastSort = 9999999999;
		}

		const accessibleIds = await accountMemberService.listAccessibleAccountIds(c, userId);

		if (accessibleIds.length === 0) {
			return [];
		}

		const memberRoleMap = await accountMemberService.getMemberMapForAccounts(c, accessibleIds);
		const memberCountMap = await accountMemberService.countMembersForAccounts(c, accessibleIds);

		const rows = await orm(c)
			.select({
				accountId: account.accountId,
				email: account.email,
				name: account.name,
				userId: account.userId,
				status: account.status,
				latestEmailTime: account.latestEmailTime,
				allReceive: account.allReceive,
				sort: account.sort,
				ownerEmail: userEntity.email,
			})
			.from(account)
			.leftJoin(userEntity, eq(userEntity.userId, account.userId))
			.where(
				and(
					inArray(account.accountId, accessibleIds),
					eq(account.isDel, isDel.NORMAL),
					or(
						lt(account.sort, lastSort),
						and(
							eq(account.sort, lastSort),
							gt(account.accountId, accountId)
						)
					)
				)
			)
			.orderBy(desc(account.sort), asc(account.accountId))
			.limit(size)
			.all();

		return rows.map(row => {
			const isOwner = row.userId === userId;
			const memberRole = memberRoleMap.get(row.accountId);
			return {
				...row,
				perm: isOwner ? 'owner' : (memberRole ? (memberRole === 1 ? 'viewer' : memberRole === 2 ? 'sender' : 'admin') : null),
				memberCount: memberCountMap.get(row.accountId) || 0,
			};
		});
	},

	async delete(c, params, userId) {

		let { accountId } = params;

		const user = await userService.selectById(c, userId);
		const accountRow = await this.selectById(c, accountId);

		if (accountRow.email === user.email) {
			throw new BizError(t('delMyAccount'));
		}

		if (accountRow.userId !== user.userId) {
			throw new BizError(t('noUserAccount'));
		}

		await orm(c).update(account).set({ isDel: isDel.DELETE }).where(
			and(eq(account.userId, userId),
				eq(account.accountId, accountId)))
			.run();
	},

	async deleteByAdmin(c, params) {

		const { accountId } = params;
		const accountRow = await this.selectById(c, Number(accountId));
		if (!accountRow) {
			throw new BizError(t('senderAccountNotExist'), 404);
		}
		await emailService.physicsDeleteByAccountId(c, accountRow.accountId);
		await accountMemberService.physicsDeleteByAccountId(c, accountRow.accountId);
		await orm(c).delete(account).where(eq(account.accountId, accountRow.accountId)).run();
	},

	selectById(c, accountId) {
		return orm(c).select().from(account).where(
			and(eq(account.accountId, accountId),
				eq(account.isDel, isDel.NORMAL)))
			.get();
	},

	async insert(c, params) {
		await orm(c).insert(account).values({ ...params }).returning();
	},

	async insertList(c, list) {
		await orm(c).insert(account).values(list).run();
	},

	async physicsDeleteByUserIds(c, userIds) {
		await emailService.physicsDeleteUserIds(c, userIds);
		await accountMemberService.physicsDeleteByUserIds(c, userIds);
		await orm(c).delete(account).where(inArray(account.userId,userIds)).run();
	},

	async selectUserAccountCountList(c, userIds, del = isDel.NORMAL) {
		const result = await orm(c)
			.select({
				userId: account.userId,
				count: count(account.accountId)
			})
			.from(account)
			.where(and(
				inArray(account.userId, userIds),
				eq(account.isDel, del)
			))
			.groupBy(account.userId)
		return result;
	},

	async countUserAccount(c, userId) {
		const { num } = await orm(c).select({num: count()}).from(account).where(and(eq(account.userId, userId),eq(account.isDel, isDel.NORMAL))).get();
		return num;
	},

	async restoreByEmail(c, email) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.email, email)).run();
	},

	async restoreByUserId(c, userId) {
		await orm(c).update(account).set({isDel: isDel.NORMAL}).where(eq(account.userId, userId)).run();
	},

	async setName(c, params, userId) {
		const { name, accountId } = params
		if (name.length > 30) {
			throw new BizError(t('usernameLengthLimit'));
		}
		const canRename = await accountMemberService.can(c, Number(accountId), userId, 'rename');
		if (!canRename) {
			throw new BizError(t('noPerm'), 403);
		}
		await orm(c).update(account).set({name}).where(eq(account.accountId, Number(accountId))).run();
	},

	async allAccount(c, params) {

		let { userId, num, size } = params

		userId = Number(userId)

		num = Number(num)
		size = Number(size)

		if (size > 30) {
			size = 30;
		}

		num = (num - 1) * size;

		const userRow = await userService.selectByIdIncludeDel(c, userId);

		const list = await orm(c).select().from(account).where(and(eq(account.userId, userId),ne(account.email,userRow.email))).limit(size).offset(num);
		const { total } = await orm(c).select({ total: count() }).from(account).where(eq(account.userId, userId)).get();

		return { list, total }
	},

	async physicsDelete(c, params) {
		const { accountId } = params
		await emailService.physicsDeleteByAccountId(c, accountId)
		await accountMemberService.physicsDeleteByAccountId(c, accountId)
		await orm(c).delete(account).where(eq(account.accountId, accountId)).run();
	},

	async renameByAdmin(c, params) {
		const { accountId, name } = params;
		if (!name || name.length > 30) {
			throw new BizError(t('usernameLengthLimit'));
		}
		const accountRow = await this.selectById(c, Number(accountId));
		if (!accountRow) {
			throw new BizError(t('senderAccountNotExist'), 404);
		}
		await orm(c).update(account).set({ name }).where(eq(account.accountId, accountRow.accountId)).run();
	},

	async addForUser(c, params) {
		const { email, userId, name } = params;

		if (!email || !verifyUtils.isEmail(email)) {
			throw new BizError(t('notEmail'));
		}

		const { domainList } = await settingService.query(c);
		if (!domainList.includes('@' + emailUtils.getDomain(email))) {
			throw new BizError(t('notExistDomain'));
		}

		const targetUser = await userService.selectById(c, Number(userId));
		if (!targetUser) {
			throw new BizError(t('notExistUser'));
		}

		let existing = await this.selectByEmailIncludeDel(c, email);
		if (existing && existing.isDel === isDel.DELETE) {
			throw new BizError(t('isDelAccount'));
		}
		if (existing) {
			throw new BizError(t('isRegAccount'));
		}

		const accountName = name || emailUtils.getName(email);
		await orm(c).insert(account).values({
			email,
			userId: targetUser.userId,
			name: accountName,
		}).run();
	},

	async setAllReceive(c, params, userId) {
		const { accountId } = params;
		const numId = Number(accountId);
		const canManage = await accountMemberService.can(c, numId, userId, 'setAllReceive');
		if (!canManage) {
			throw new BizError(t('noPerm'), 403);
		}
		const accountRow = await this.selectById(c, numId);
		if (!accountRow) return;
		await orm(c).update(account).set({ allReceive: accountConst.allReceive.CLOSE }).where(eq(account.userId, accountRow.userId)).run();
		await orm(c).update(account).set({ allReceive: accountRow.allReceive ? 0 : 1 }).where(eq(account.accountId, numId)).run();
	},

	async setAsTop(c, params, userId) {
		const { accountId } = params;
		const canRename = await accountMemberService.can(c, Number(accountId), userId, 'rename');
		if (!canRename) {
			throw new BizError(t('noPerm'), 403);
		}
		const accountRow = await this.selectById(c, Number(accountId));
		if (!accountRow) return;
		const ownerUser = await userService.selectById(c, accountRow.userId);
		const mainAccountRow = await accountService.selectByEmailIncludeDel(c, ownerUser.email);
		let mainSort = mainAccountRow.sort === 0 ? 2 : mainAccountRow.sort + 1;
		await orm(c).update(account).set({ sort: mainSort }).where(eq(account.email, ownerUser.email )).run();
		await orm(c).update(account).set({ sort: mainSort - 1 }).where(eq(account.accountId, Number(accountId))).run();
	}
};

export default accountService;
