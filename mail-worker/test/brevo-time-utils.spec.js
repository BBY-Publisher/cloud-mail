import { describe, expect, it } from 'vitest';
import { brevoDateRange, resolveBrevoSentTime } from '../src/utils/brevo-time-utils';

describe('Brevo send time', () => {
	it('uses the send date instead of later delivery or open events', () => {
		expect(resolveBrevoSentTime({ content: {
			date: '2026-07-17T16:00:00.123+08:00',
			events: [{ name: 'opened', time: '2026-07-20T12:00:00Z' }]
		} })).toBe('2026-07-17 08:00:00.123');
	});
	it('falls back to the earliest valid sent event, then list send date', () => {
		expect(resolveBrevoSentTime({ content: { date: 'invalid', events: [
			{ name: 'sent', time: '2026-07-17T08:01:00Z' },
			{ name: 'sent', time: '2026-07-17T08:00:00Z' },
			{ name: 'sent', time: 'invalid' },
			{ name: 'delivered', time: '2026-07-16T08:00:00Z' }
		] } })).toBe('2026-07-17 08:00:00.000');
		expect(resolveBrevoSentTime({ content: {}, listItem: { date: '2026-07-17T08:00:00Z' } }))
			.toBe('2026-07-17 08:00:00.000');
	});
	it.each([undefined, '', 'bad', '2026-02-30T08:00:00Z', '2026-07-17 08:00:00'])
	('rejects missing, invalid and timezone-free dates: %s', date => {
		expect(() => resolveBrevoSentTime({ content: { date, events: [
			{ name: 'opened', time: '2026-07-17T08:00:00Z' }
		] } })).toThrow('send time');
	});
	it('handles timezone day boundaries and daylight-saving offsets', () => {
		expect(resolveBrevoSentTime({ date: '2026-07-17T00:30:00+02:00' })).toBe('2026-07-16 22:30:00.000');
		expect(resolveBrevoSentTime({ date: '2026-01-17T00:30:00+01:00' })).toBe('2026-01-16 23:30:00.000');
	});
	it('requires paired valid dates in a bounded historical window', () => {
		expect(brevoDateRange()).toEqual({});
		expect(brevoDateRange({ startDate: '2026-07-01', endDate: '2026-07-30' })).toEqual({ startDate: '2026-07-01', endDate: '2026-07-30' });
		for (const range of [
			{ startDate: '2026-07-01' },
			{ startDate: '2026-02-30', endDate: '2026-03-01' },
			{ startDate: '2026-07-02', endDate: '2026-07-01' },
			{ startDate: '2026-07-01', endDate: '2026-08-01' }
		]) expect(() => brevoDateRange(range)).toThrow();
	});
});
