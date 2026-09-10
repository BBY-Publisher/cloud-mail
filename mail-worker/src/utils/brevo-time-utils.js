import BizError from '../error/biz-error';

// Provider dates must carry an offset. Never interpret a webhook's local date
// as UTC, or substitute the import/open/delivery time for the send time.
export function parseBrevoDate(value) {
	if (typeof value !== 'string') return null;
	const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i);
	if (!match) return null;
	const calendar = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	if (calendar.toISOString().slice(0, 10) !== match[0].slice(0, 10)) return null;
	const timestamp = Date.parse(match[0]);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveBrevoSentTime(detail) {
	const content = detail?.content || detail || {};
	let timestamp = parseBrevoDate(content.date);
	if (timestamp === null) {
		const sentTimes = (Array.isArray(content.events) ? content.events : [])
			.filter(event => event?.name === 'sent')
			.map(event => parseBrevoDate(event.time))
			.filter(time => time !== null);
		if (sentTimes.length) timestamp = Math.min(...sentTimes);
	}
	if (timestamp === null) timestamp = parseBrevoDate(detail?.listItem?.date);
	if (timestamp === null) throw new BizError('Brevo send time is missing or invalid; retry after checking provider history');
	return new Date(timestamp).toISOString().replace('T', ' ').replace('Z', '');
}

export function brevoDateRange({ startDate, endDate } = {}) {
	if (!startDate && !endDate) return {};
	const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
		&& parseBrevoDate(`${value}T00:00:00Z`) !== null;
	if (!valid(startDate) || !valid(endDate) || startDate > endDate
		|| Date.parse(endDate) - Date.parse(startDate) > 29 * 86400000) {
		throw new BizError('Choose a valid Brevo send-date range of at most 30 days', 400);
	}
	return { startDate, endDate };
}
