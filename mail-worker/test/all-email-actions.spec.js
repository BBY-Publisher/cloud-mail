import { describe, expect, it } from 'vitest';
import {
	canComposeFromAllEmail
} from '../../mail-vue/src/utils/all-email-actions';

describe('all-email actions', () => {
	it('allows reply and forward for emails without a recipient account', () => {
		expect(canComposeFromAllEmail({ status: 7 })).toBe(true);
	});

	it('keeps reply and forward disabled for other all-email records', () => {
		expect(canComposeFromAllEmail({ status: 0 })).toBe(false);
		expect(canComposeFromAllEmail({ status: 2 })).toBe(false);
	});
});
