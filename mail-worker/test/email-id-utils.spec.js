import { describe, expect, it } from 'vitest';
import { parseEmailIds } from '../src/utils/email-id-utils';

describe('parseEmailIds', () => {
	it('parses comma-separated email IDs', () => {
		expect(parseEmailIds('12,34')).toEqual([12, 34]);
	});

	it('accepts email IDs from a JSON array', () => {
		expect(parseEmailIds([12, 34])).toEqual([12, 34]);
	});

	it('accepts a single numeric email ID', () => {
		expect(parseEmailIds(12)).toEqual([12]);
	});

	it('ignores empty and invalid email IDs', () => {
		expect(parseEmailIds([12, '', 'invalid', null, 0, -1, 3.5])).toEqual([12]);
		expect(parseEmailIds()).toEqual([]);
	});
});
