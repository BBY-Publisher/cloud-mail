import r2Service from '../service/r2-service';
import kvObjService from '../service/kv-obj-service';
import app from '../hono/hono';

function secureObjectResponse(response) {
	const headers = new Headers(response.headers);
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
	headers.set('Referrer-Policy', 'no-referrer');
	return new Response(response.body, {
		status: response.status,
		headers
	});
}

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	let obj = null;

	if (c.env.r2) {
		obj = await c.env.r2.get(key);
	}

	if (obj) {
		const headers = new Headers();
		obj.writeHttpMetadata(headers);
		if (obj.httpEtag) {
			headers.set('ETag', obj.httpEtag);
		}
		return secureObjectResponse(new Response(obj.body, { headers }));
	}

	if (await r2Service.storageType(c) === 'S3') {
		return secureObjectResponse(await r2Service.getObj(c, key));
	}

	const kvResponse = await kvObjService.getObj(c, key);
	if (kvResponse) {
		return secureObjectResponse(kvResponse);
	}

	return new Response('Not found', { status: 404 });
});
