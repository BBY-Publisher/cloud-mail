import app from '../hono/hono';
import accountService from '../service/account-service';
import accountMemberService from '../service/account-member-service';
import result from '../model/result';
import userContext from '../security/user-context';

app.get('/account/list', async (c) => {
	const list = await accountService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.delete('/account/delete', async (c) => {
	await accountService.delete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.post('/account/add', async (c) => {
	const account = await accountService.add(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(account));
});

app.put('/account/setName', async (c) => {
	await accountService.setName(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.put('/account/setAllReceive', async (c) => {
	await accountService.setAllReceive(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.put('/account/setAsTop', async (c) => {
	await accountService.setAsTop(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/account/member/list', async (c) => {
	const params = c.req.query();
	const accountId = Number(params.accountId);
	const list = await accountMemberService.listMembers(c, accountId, userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.post('/account/member/add', async (c) => {
	const body = await c.req.json();
	await accountMemberService.addMember(
		c,
		Number(body.accountId),
		body.email,
		body.role,
		userContext.getUserId(c)
	);
	return c.json(result.ok());
});

app.delete('/account/member/remove', async (c) => {
	const params = c.req.query();
	await accountMemberService.removeMember(
		c,
		Number(params.accountId),
		Number(params.userId),
		userContext.getUserId(c)
	);
	return c.json(result.ok());
});

app.put('/account/member/role', async (c) => {
	const body = await c.req.json();
	await accountMemberService.setMemberRole(
		c,
		Number(body.accountId),
		Number(body.userId),
		body.role,
		userContext.getUserId(c)
	);
	return c.json(result.ok());
});
