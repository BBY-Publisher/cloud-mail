import { describe, expect, it } from 'vitest';
import { prepareBrevoEmailContent } from '../src/utils/brevo-email-utils';

describe('prepareBrevoEmailContent', () => {
	it('replaces CID image sources with public object URLs', () => {
		const inlineImage = {
			key: 'attachments/image one.png',
			filename: 'image one.png',
			contentId: 'image-cid',
			content: 'aW1hZ2U='
		};

		const result = prepareBrevoEmailContent({
			html: '<p>Before</p><img src="cid:image-cid"><p>After</p>',
			attachments: [inlineImage],
			publicBaseUrl: 'https://assets.example.com/'
		});

		expect(result.html).toContain('src="https://assets.example.com/attachments/image%20one.png"');
		expect(result.html).not.toContain('cid:image-cid');
		expect(result.inlineAttachments).toEqual([inlineImage]);
		expect(result.attachments).toEqual([]);
	});

	it('keeps ordinary attachments and unmatched CID references unchanged', () => {
		const attachment = {
			filename: 'invoice.pdf',
			content: 'cGRm'
		};

		const result = prepareBrevoEmailContent({
			html: '<img src="cid:unknown">',
			attachments: [attachment],
			publicBaseUrl: 'https://assets.example.com'
		});

		expect(result.html).toContain('src="cid:unknown"');
		expect(result.inlineAttachments).toEqual([]);
		expect(result.attachments).toEqual([attachment]);
	});

	it('normalizes bracketed content IDs', () => {
		const result = prepareBrevoEmailContent({
			html: '<img src="cid:logo-cid">',
			attachments: [{ key: 'attachments/logo.png', contentId: '<logo-cid>' }],
			publicBaseUrl: 'assets.example.com'
		});

		expect(result.html).toContain('src="https://assets.example.com/attachments/logo.png"');
	});

	it('rejects inline images when no public object URL is configured', () => {
		expect(() => prepareBrevoEmailContent({
			html: '<img src="cid:image-cid">',
			attachments: [{ key: 'attachments/image.png', contentId: 'image-cid' }],
			publicBaseUrl: ''
		})).toThrow('public object storage domain');
	});
});
