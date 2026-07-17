import { describe, expect, it } from 'vitest';
import {
	buildBrevoEventKey,
	getProviderEventTime,
	normalizeBrevoEventName,
	normalizeProviderEmailId,
	providerEmailIdCandidates
} from '../src/utils/provider-webhook-utils';

describe('provider webhook identifiers', () => {
	it('normalizes Brevo message IDs while preserving Resend IDs', () => {
		expect(normalizeProviderEmailId('brevo', ' <abc@relay.example> ')).toBe('abc@relay.example');
		expect(normalizeProviderEmailId('resend', ' 6d7f-id ')).toBe('6d7f-id');
	});

	it('returns aliases for legacy Brevo rows stored with angle brackets', () => {
		expect(providerEmailIdCandidates('brevo', '<abc@relay.example>')).toEqual([
			'abc@relay.example',
			'<abc@relay.example>'
		]);
	});
});

describe('provider webhook event normalization', () => {
	it.each([
		['hardBounce', 'hard_bounce'],
		['hard_bounce', 'hard_bounce'],
		['softBounce', 'soft_bounce'],
		['soft_bounce', 'soft_bounce'],
		['invalid', 'invalid_email'],
		['invalid_email', 'invalid_email']
	])('normalizes Brevo event %s to %s', (input, expected) => {
		expect(normalizeBrevoEventName(input)).toBe(expected);
	});

	it('uses the provider event timestamp instead of receipt time', () => {
		expect(getProviderEventTime('resend', {
			created_at: '2026-07-17T08:00:00.123Z'
		})).toBe(Date.parse('2026-07-17T08:00:00.123Z'));

		expect(getProviderEventTime('brevo', {
			ts_event: 1_721_234_567
		})).toBe(1_721_234_567_000);
	});

	it('creates the same Brevo event key for camelCase and snake_case aliases', async () => {
		const base = {
			'message-id': '<abc@relay.example>',
			email: 'recipient@example.com',
			ts_event: 1_721_234_567
		};

		expect(await buildBrevoEventKey({ ...base, event: 'hardBounce' }))
			.toBe(await buildBrevoEventKey({ ...base, event: 'hard_bounce' }));
	});
});
