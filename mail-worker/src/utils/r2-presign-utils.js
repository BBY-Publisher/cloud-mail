const encoder = new TextEncoder();
const MAX_PRESIGN_EXPIRY = 7 * 24 * 60 * 60;

function awsEncode(value) {
	return encodeURIComponent(String(value))
		.replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(value) {
	return String(value)
		.split('/')
		.map(awsEncode)
		.join('/');
}

function toHex(buffer) {
	return [...new Uint8Array(buffer)]
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function sha256(value) {
	return crypto.subtle.digest('SHA-256', encoder.encode(value));
}

async function hmac(key, value) {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		typeof key === 'string' ? encoder.encode(key) : key,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

function normalizeHeaderValue(value) {
	return String(value ?? '')
		.replace(/[\r\n]/g, '')
		.trim()
		.replace(/\s+/g, ' ');
}

function requestTarget(endpointValue, bucket, key, forcePathStyle) {
	const endpoint = new URL(endpointValue);
	if (endpoint.protocol !== 'https:') {
		throw new Error('R2 endpoint must use HTTPS');
	}
	if (!endpoint.hostname.endsWith('.r2.cloudflarestorage.com')) {
		throw new Error('R2 endpoint must use a Cloudflare R2 S3 API hostname');
	}
	if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
		throw new Error('Invalid R2 endpoint');
	}

	const basePath = endpoint.pathname.replace(/\/+$/, '');
	const objectPath = forcePathStyle
		? `${basePath}/${encodePath(bucket)}/${encodePath(key)}`
		: `${basePath}/${encodePath(key)}`;
	const host = forcePathStyle
		? endpoint.host
		: `${bucket}.${endpoint.host}`;

	return {
		host,
		path: objectPath.startsWith('/') ? objectPath : `/${objectPath}`,
		origin: `${endpoint.protocol}//${host}`
	};
}

function canonicalQuery(params) {
	return Object.entries(params)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
		.join('&');
}

export async function presignR2Put({
	method = 'PUT',
	bucket,
	key,
	endpoint,
	region = 'auto',
	expiresIn = 300,
	forcePathStyle = false,
	headers = {},
	credentials,
	now = new Date()
}) {
	if (!bucket || !key || !credentials?.accessKeyId || !credentials?.secretAccessKey) {
		throw new Error('Missing R2 signing configuration');
	}
	if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0 || expiresIn > MAX_PRESIGN_EXPIRY) {
		throw new Error('Invalid presigned URL expiry');
	}

	const target = requestTarget(endpoint, bucket, key, forcePathStyle);
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	const dateStamp = amzDate.slice(0, 8);
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const normalizedHeaders = Object.fromEntries(
		Object.entries({ ...headers, host: target.host })
			.map(([name, value]) => [name.toLowerCase(), normalizeHeaderValue(value)])
			.sort(([left], [right]) => left.localeCompare(right))
	);
	const signedHeaders = Object.keys(normalizedHeaders).join(';');
	const canonicalHeaders = Object.entries(normalizedHeaders)
		.map(([name, value]) => `${name}:${value}\n`)
		.join('');
	const query = canonicalQuery({
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
		'X-Amz-Credential': `${credentials.accessKeyId}/${credentialScope}`,
		'X-Amz-Date': amzDate,
		'X-Amz-Expires': String(expiresIn),
		'X-Amz-SignedHeaders': signedHeaders
	});
	const canonicalRequest = [
		method.toUpperCase(),
		target.path,
		query,
		canonicalHeaders,
		signedHeaders,
		'UNSIGNED-PAYLOAD'
	].join('\n');
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		toHex(await sha256(canonicalRequest))
	].join('\n');
	const dateKey = await hmac(`AWS4${credentials.secretAccessKey}`, dateStamp);
	const regionKey = await hmac(dateKey, region);
	const serviceKey = await hmac(regionKey, 's3');
	const signingKey = await hmac(serviceKey, 'aws4_request');
	const signature = toHex(await hmac(signingKey, stringToSign));

	return `${target.origin}${target.path}?${query}&X-Amz-Signature=${signature}`;
}
