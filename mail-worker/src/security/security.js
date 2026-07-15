import BizError from '../error/biz-error';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import dayjs from 'dayjs';
import userService from '../service/user-service';
import permService from '../service/perm-service';
import settingService from '../service/setting-service';
import { t } from '../i18n/i18n'
import app from '../hono/hono';

const exclude = [
	'/login',
	'/register',
	'/oss',
	'/setting/websiteConfig',
	'/webhooks',
	'/init',
	'/public/genToken',
	'/telegram',
	'/test',
	'/oauth'
];

const requirePerms = [
	'/email/send',
	'/email/delete',
	'/email/sync',
	'/account/list',
	'/account/delete',
	'/account/add',
	'/account/member/list',
	'/account/member/add',
	'/account/member/remove',
	'/account/member/role',
	'/admin/account/add',
	'/admin/account/rename',
	'/admin/account/delete',
	'/my/delete',
	'/analysis/echarts',
	'/role/add',
	'/role/list',
	'/role/delete',
	'/role/tree',
	'/role/set',
	'/role/setDefault',
	'/allEmail/list',
	'/allEmail/delete',
	'/allEmail/batchDelete',
	'/allEmail/latest',
	'/setting/setBackground',
	'/setting/deleteBackground',
	'/setting/set',
	'/setting/query',
	'/setting/setBlacklist',
	'/setting/migrateAttachments',
	'/user/delete',
	'/user/setPwd',
	'/user/setStatus',
	'/user/setType',
	'/user/list',
	'/user/restore',
	'/user/resetSendCount',
	'/user/add',
	'/user/deleteAccount',
	'/user/allAccount',
	'/regKey/add',
	'/regKey/list',
	'/regKey/delete',
	'/regKey/clearNotUse',
	'/regKey/history',
	'/signature/list',
	'/signature/set',
	'/webhookEvent/list',
	'/webhookEvent/clear'
];

const premKey = {
	'email:delete': ['/email/delete'],
	'email:send': ['/email/send'],
	'email:sync': ['/email/sync'],
	'account:add': ['/account/add'],
	'account:query': ['/account/list'],
	'account:delete': ['/account/delete'],
	'account:member:query': ['/account/member/list'],
	'account:member:set': ['/account/member/add', '/account/member/remove', '/account/member/role'],
	'admin:account:add': ['/admin/account/add'],
	'admin:account:rename': ['/admin/account/rename'],
	'admin:account:delete': ['/admin/account/delete'],
	'my:delete': ['/my/delete'],
	'role:add': ['/role/add'],
	'role:set': ['/role/set','/role/setDefault'],
	'role:query': ['/role/list', '/role/tree'],
	'role:delete': ['/role/delete'],
	'user:query': ['/user/list','/user/allAccount'],
	'user:add': ['/user/add'],
	'user:reset-send': ['/user/resetSendCount'],
	'user:set-pwd': ['/user/setPwd'],
	'user:set-status': ['/user/setStatus', '/user/restore'],
	'user:set-type': ['/user/setType'],
	'user:delete': ['/user/delete','/user/deleteAccount'],
	'all-email:delete': ['/allEmail/delete','/allEmail/batchDelete'],
	'setting:query': ['/setting/query'],
	'setting:set': ['/setting/set', '/setting/setBackground','/setting/deleteBackground','/setting/setBlacklist','/setting/migrateAttachments'],
	'analysis:query': ['/analysis/echarts'],
	'reg-key:add': ['/regKey/add'],
	'reg-key:query': ['/regKey/list','/regKey/history'],
	'reg-key:delete': ['/regKey/delete','/regKey/clearNotUse'],
	'signature:query': ['/signature/list'],
	'signature:set': ['/signature/set'],
	'webhook-event:query': ['/webhookEvent/list'],
	'webhook-event:clear': ['/webhookEvent/clear', '/webhookEvent/list'],
	'all-email:query': ['/allEmail/list','/allEmail/latest','/allEmail/get'],
};

app.use('*', async (c, next) => {

	const path = c.req.path;

	const index = exclude.findIndex(item => {
		return path.startsWith(item);
	});

	if (index > -1) {
		return await next();
	}

	if (path.startsWith('/public')) {

		const userPublicToken = await c.env.kv.get(KvConst.PUBLIC_KEY);
		const publicToken = c.req.header(constant.TOKEN_HEADER);
		if (publicToken !== userPublicToken) {
			throw new BizError(t('publicTokenFail'), 401);
		}
		return await next();
	}


	const jwt = c.req.header(constant.TOKEN_HEADER);

	const result = await jwtUtils.verifyToken(c, jwt);

	if (!result) {
		throw new BizError(t('authExpired'), 401);
	}

	const { userId, token } = result;
	const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });

	if (!authInfo) {
		throw new BizError(t('authExpired'), 401);
	}

	if (!authInfo.tokens.includes(token)) {
		throw new BizError(t('authExpired'), 401);
	}

	const permIndex = requirePerms.findIndex(item => {
		return path.startsWith(item);
	});

	if (permIndex > -1) {

		const [permKeys, setting] = await Promise.all([
			permService.userPermKeys(c, authInfo.user.userId),
			settingService.query(c)
		]);

		const userPaths = permKeyToPaths(permKeys);

		const userPermIndex = userPaths.findIndex(item => {
			return path.startsWith(item);
		});

		if (userPermIndex === -1 && !settingService.isAdmin(setting, authInfo.user.email)) {
			throw new BizError(t('unauthorized'), 403);
		}

	}

	const refreshTime = dayjs(authInfo.refreshTime).startOf('day');
	const nowTime = dayjs().startOf('day')

	if (!nowTime.isSame(refreshTime)) {
		authInfo.refreshTime = dayjs().toISOString();
		await userService.updateUserInfo(c, authInfo.user.userId);
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	}

	c.set('user',authInfo.user)

	return await next();
});

function permKeyToPaths(permKeys) {

	const paths = [];

	for (const key of permKeys) {
		const routeList = premKey[key];
		if (routeList && Array.isArray(routeList)) {
			paths.push(...routeList);
		}
	}
	return paths;
}
