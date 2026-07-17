const NO_RECIPIENT_STATUS = 7;

export function canComposeFromAllEmail(email) {
	return Number(email?.status) === NO_RECIPIENT_STATUS;
}
