export const MAX_ATTACHMENT_UPLOAD_SIZE = 64 * 1024 * 1024;

const UPLOADED_ATTACHMENT_KEY_PATTERN =
	/^attachments\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[a-z0-9]{1,16})?$/i;

export function isUploadedAttachmentKey(key) {
	return UPLOADED_ATTACHMENT_KEY_PATTERN.test(String(key || ''));
}
