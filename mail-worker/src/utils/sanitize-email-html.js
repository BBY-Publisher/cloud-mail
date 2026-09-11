import { parseHTML } from 'linkedom';

const FORBIDDEN_TAGS = [
	'base', 'button', 'embed', 'form', 'frame', 'frameset', 'iframe', 'input',
	'link', 'math', 'meta', 'object', 'option', 'script', 'select', 'style',
	'svg', 'textarea'
];

const FORBIDDEN_ATTRIBUTES = new Set([
	'autofocus', 'formaction', 'ping', 'srcdoc', 'srcset', 'xlink:href'
]);

const DANGEROUS_CSS = /(?:@import|behavior\s*:|expression\s*\(|-moz-binding|position\s*:\s*(?:fixed|sticky)|url\s*\()/i;
const SAFE_IMAGE_DATA = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

function hasSafeProtocol(value, protocols) {
	try {
		return protocols.includes(new URL(value).protocol);
	} catch (_) {
		return false;
	}
}

export function escapeEmailText(text = '') {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function sanitizeEmailHtml(html = '') {
	const { document } = parseHTML(`<html><body>${String(html)}</body></html>`);

	document.querySelectorAll(FORBIDDEN_TAGS.join(',')).forEach(element => element.remove());
	document.querySelectorAll('*').forEach(element => {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();
			if (name.startsWith('on') || FORBIDDEN_ATTRIBUTES.has(name)) {
				element.removeAttribute(attribute.name);
			}
		}

		const style = element.getAttribute('style');
		if (style && DANGEROUS_CSS.test(style)) element.removeAttribute('style');
	});

	document.querySelectorAll('a').forEach(link => {
		const href = link.getAttribute('href') || '';
		if (!hasSafeProtocol(href, ['https:', 'http:', 'mailto:'])) {
			link.removeAttribute('href');
			link.removeAttribute('target');
			link.removeAttribute('rel');
			return;
		}
		link.setAttribute('target', '_blank');
		link.setAttribute('rel', 'noopener noreferrer');
	});

	document.querySelectorAll('img').forEach(image => {
		const src = image.getAttribute('src') || '';
		if (!hasSafeProtocol(src, ['https:', 'http:']) && !SAFE_IMAGE_DATA.test(src)) {
			image.removeAttribute('src');
		}
		image.setAttribute('loading', 'lazy');
		image.setAttribute('decoding', 'async');
		image.setAttribute('referrerpolicy', 'no-referrer');
	});

	return document.body.innerHTML;
}
