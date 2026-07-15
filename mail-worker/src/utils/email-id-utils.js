export function parseEmailIds(emailIds) {
	const values = Array.isArray(emailIds) ? emailIds : [emailIds];

	return values
		.flatMap(value => String(value ?? '').split(','))
		.map(Number)
		.filter(emailId => Number.isInteger(emailId) && emailId > 0);
}
