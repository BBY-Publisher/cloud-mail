import { MAX_ATTACHMENT_UPLOAD_SIZE } from '../const/attachment-const';
import { parseHTML } from 'linkedom';

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function safeDownloadUrl(value) {
	try {
		const url = new URL(String(value || ''));
		return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
	} catch (_) {
		return '';
	}
}

export function isExternalAttachment(attachment) {
	return attachment?.storageType === 'external' && !!safeDownloadUrl(attachment.url);
}

function formatBytes(bytes) {
	const size = Number(bytes) || 0;
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function isUploadedR2Attachment(attachment) {
	return attachment?.storageType === 'R2'
		&& typeof attachment.key === 'string'
		&& typeof attachment.url === 'string';
}

export function partitionEmailAttachments(attachments = []) {
	const uploaded = [];
	const provider = [];

	for (const attachment of attachments || []) {
		if (isUploadedR2Attachment(attachment)) {
			uploaded.push(attachment);
		} else {
			provider.push(attachment);
		}
	}

	return { uploaded, provider };
}

export function normalizeUploadedAttachmentUrls(attachments = [], origin) {
	const trustedOrigin = new URL(origin).origin;
	return attachments.map(attachment => ({
		...attachment,
		url: `${trustedOrigin}/api/oss/${attachment.key}`
	}));
}

function base64ByteSize(content) {
	if (typeof content !== 'string' || !content.trim()) {
		return 0;
	}

	const encoded = content
		.replace(/^data:[^,]*,/, '')
		.replace(/\s/g, '');
	if (!encoded || encoded.length % 4 === 1) {
		return 0;
	}

	const padding = (encoded.match(/=*$/) || [''])[0].length;
	return Math.floor(encoded.length * 3 / 4) - padding;
}

export function findInvalidAttachment(attachments = [], maxSize = MAX_ATTACHMENT_UPLOAD_SIZE) {
	for (const attachment of attachments || []) {
		if (!attachment || typeof attachment.filename !== 'string' || !attachment.filename.trim()) {
			return attachment || { filename: '' };
		}
		if (isExternalAttachment(attachment)) continue;

		const size = isUploadedR2Attachment(attachment)
			? Number(attachment.size)
			: base64ByteSize(attachment.content);

		if (!Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
			return attachment;
		}
	}

	return null;
}

export function appendUploadedAttachmentLinks(html = '', attachments = []) {
	const { document } = parseHTML(String(html));
	const existingUrls = new Set(Array.from(document.querySelectorAll('a[href]'))
		.map(link => link.getAttribute('href')));

	const items = attachments
		.map(attachment => ({
			...attachment,
			safeUrl: safeDownloadUrl(attachment.url)
		}))
		.filter(attachment => attachment.safeUrl && !existingUrls.has(attachment.safeUrl));

	if (items.length === 0) {
		return html;
	}

	const links = items.map(attachment => `
		<li style="margin:6px 0">
			<a href="${escapeHtml(attachment.safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.filename || 'attachment')}</a>
			<span style="color:#777;margin-left:8px">(${escapeHtml(formatBytes(attachment.size))})</span>
		</li>`).join('');

	return `${html}
	<div data-cloud-mail-attachments="true" style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd">
		<div style="font-weight:600">附件 / Attachments</div>
		<ul style="margin:8px 0 0;padding-left:20px">${links}
		</ul>
	</div>`;
}

export function appendUploadedAttachmentTextLinks(text = '', attachments = []) {
	const lines = attachments
		.map(attachment => ({
			name: attachment.filename || 'attachment',
			url: safeDownloadUrl(attachment.url)
		}))
		.filter(attachment => attachment.url)
		.map(attachment => `- ${attachment.name}: ${attachment.url}`);

	if (lines.length === 0) {
		return text;
	}

	return `${text || ''}\n\nAttachments:\n${lines.join('\n')}`.trim();
}
