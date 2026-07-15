import { parseHTML } from 'linkedom';
import domainUtils from './domain-uitls';

function normalizeContentId(contentId = '') {
	return contentId.replace(/^cid:/i, '').replace(/^<|>$/g, '');
}

export function resolveBrevoPublicBaseUrl({ configuredBaseUrl, storageType, requestUrl }) {
	const configuredDomain = domainUtils.toOssDomain(String(configuredBaseUrl || '').trim());
	if (configuredDomain) {
		return configuredDomain;
	}

	if (storageType !== 'KV' || !requestUrl) {
		return '';
	}

	try {
		return new URL(requestUrl).origin;
	} catch (_) {
		return '';
	}
}

export function prepareBrevoEmailContent({ html = '', attachments = [], publicBaseUrl }) {
	const inlineAttachments = attachments.filter(attachment => attachment.contentId);
	const regularAttachments = attachments.filter(attachment => !attachment.contentId);

	if (inlineAttachments.length === 0) {
		return {
			html,
			inlineAttachments,
			attachments: regularAttachments
		};
	}

	const publicDomain = domainUtils.toOssDomain(publicBaseUrl);
	if (!publicDomain) {
		throw new Error('Brevo inline images require a public object storage domain');
	}

	const attachmentsByCid = new Map(
		inlineAttachments.map(attachment => [normalizeContentId(attachment.contentId), attachment])
	);
	const { document } = parseHTML(html);

	for (const image of document.querySelectorAll('img')) {
		const src = image.getAttribute('src');
		if (!src?.toLowerCase().startsWith('cid:')) {
			continue;
		}

		const attachment = attachmentsByCid.get(normalizeContentId(src));
		if (!attachment?.key) {
			continue;
		}

		const key = attachment.key.replace(/^\/+/, '');
		image.setAttribute('src', new URL(key, `${publicDomain}/`).toString());
	}

	return {
		html: document.toString(),
		inlineAttachments,
		attachments: regularAttachments
	};
}
