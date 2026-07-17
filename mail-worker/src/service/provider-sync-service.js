import brevoService from './brevo-service';
import resendService from './resend-service';

const providerSyncService = {

	async sync(c) {
		const providers = {};
		const errors = [];

		try {
			providers.resend = await resendService.syncFromProvider(c);
			errors.push(...(providers.resend.errors || []));
		} catch (error) {
			providers.resend = {
				inserted: 0,
				updated: 0,
				skipped: 0,
				error: error?.message || String(error)
			};
			errors.push(`resend: ${error?.message || error}`);
		}

		try {
			providers.brevo = await brevoService.syncFromProvider(c);
			errors.push(...(providers.brevo.errors || []));
		} catch (error) {
			providers.brevo = {
				inserted: 0,
				updated: 0,
				skipped: 0,
				error: error?.message || String(error)
			};
			errors.push(`brevo: ${error?.message || error}`);
		}

		return {
			configured: providers.resend?.configured === true || providers.brevo?.configured === true,
			inserted: (providers.resend?.inserted || 0) + (providers.brevo?.inserted || 0),
			updated: (providers.resend?.updated || 0) + (providers.brevo?.updated || 0),
			skipped: (providers.resend?.skipped || 0) + (providers.brevo?.skipped || 0),
			errors,
			providers
		};
	}
};

export default providerSyncService;
