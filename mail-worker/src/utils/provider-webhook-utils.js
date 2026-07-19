const BREVO_EVENT_ALIASES = {
	hardBounce: 'hard_bounce',
	hardbounce: 'hard_bounce',
	hard_bounce: 'hard_bounce',
	softBounce: 'soft_bounce',
	softbounce: 'soft_bounce',
	soft_bounce: 'soft_bounce',
	invalid: 'invalid_email',
	invalidEmail: 'invalid_email',
	invalid_email: 'invalid_email',
	uniqueOpened: 'unique_opened',
	uniqueopened: 'unique_opened',
	proxyOpen: 'proxy_open',
	uniqueProxyOpen: 'unique_proxy_open'
};

export function normalizeProviderEmailId(provider, value) {
	if (value === null || value === undefined) return '';

	const trimmed = String(value).trim();
	if (!trimmed) return '';

	if (provider === 'brevo' && trimmed.startsWith('<') && trimmed.endsWith('>')) {
		return trimmed.slice(1, -1).trim();
	}

	return trimmed;
}

export function providerEmailIdCandidates(provider, value) {
	const normalized = normalizeProviderEmailId(provider, value);
	if (!normalized) return [];

	if (provider !== 'brevo') return [normalized];

	return [...new Set([normalized, `<${normalized}>`])];
}

export function toBrevoApiMessageId(value) {
	const normalized = normalizeProviderEmailId('brevo', value);
	return normalized ? `<${normalized}>` : value;
}

export function normalizeBrevoEventName(value) {
	if (!value) return '';
	const event = String(value).trim();
	return BREVO_EVENT_ALIASES[event] || event;
}

function toEpochMilliseconds(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric <= 0) return 0;
	return numeric >= 1_000_000_000_000 ? Math.trunc(numeric) : Math.trunc(numeric * 1000);
}

export function getProviderEventTime(provider, body) {
	if (provider === 'resend') {
		const parsed = Date.parse(body?.created_at || body?.data?.created_at || '');
		return Number.isFinite(parsed) ? parsed : 0;
	}

	if (provider === 'brevo') {
		return toEpochMilliseconds(body?.ts_event)
			|| toEpochMilliseconds(body?.ts_epoch)
			|| toEpochMilliseconds(body?.ts);
	}

	return 0;
}

export function getProviderStatusRank(status) {
	switch (Number(status)) {
		case 1: // SENT
			return 10;
		case 5: // DELAYED
			return 20;
		case 2: // DELIVERED
			return 30;
		case 3: // BOUNCED
		case 8: // FAILED
			return 40;
		case 4: // COMPLAINED
			return 50;
		default:
			return 0;
	}
}

async function sha256Hex(value) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function buildBrevoEventKey(body) {
	const messageId = normalizeProviderEmailId('brevo', body?.['message-id'] || body?.messageId);
	const event = normalizeBrevoEventName(body?.event);
	const eventTime = getProviderEventTime('brevo', body);
	const recipient = String(body?.email || '').trim().toLowerCase();
	return sha256Hex([messageId, event, eventTime, recipient].join('|'));
}

export async function buildResendEventKey(body, deliveryId) {
	if (deliveryId) return String(deliveryId);

	const messageId = normalizeProviderEmailId('resend', body?.data?.email_id);
	const eventTime = getProviderEventTime('resend', body);
	return sha256Hex([messageId, body?.type || '', eventTime].join('|'));
}

export function constantTimeEquals(left, right) {
	if (typeof left !== 'string' || typeof right !== 'string') return false;
	if (left.length !== right.length) return false;

	let diff = 0;
	for (let index = 0; index < left.length; index++) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return diff === 0;
}
