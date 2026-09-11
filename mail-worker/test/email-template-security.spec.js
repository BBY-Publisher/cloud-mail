import { describe, expect, it } from 'vitest';
import emailHtmlTemplate from '../src/template/email-html';
import emailTextTemplate from '../src/template/email-text';
import { sanitizeEmailHtml } from '../src/utils/sanitize-email-html';

describe('email content sanitization', () => {
	it('removes executable and embedded content while preserving ordinary email markup', () => {
		const html = sanitizeEmailHtml(`
			<style>@import url(https://tracker.test/style.css)</style>
			<script>window.compromised = true</script>
			<iframe src="https://attacker.test"></iframe>
			<form action="https://attacker.test"><input autofocus></form>
			<table><tr><td style="color: red">Invoice</td></tr></table>
			<img src="https://images.test/logo.png" onerror="window.compromised = true" srcset="https://tracker.test/a 2x">
			<a href="javascript:alert(1)" onclick="alert(1)">bad</a>
			<a href="https://safe.test/path">safe</a>
		`);

		expect(html).not.toMatch(/<script|<iframe|<form|<input|<style/i);
		expect(html).not.toMatch(/onerror|onclick|srcset|javascript:/i);
		expect(html).toContain('<table>');
		expect(html).toContain('style="color: red"');
		expect(html).toContain('referrerpolicy="no-referrer"');
		expect(html).toContain('href="https://safe.test/path"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it('removes CSS-based external loads and dangerous positioning', () => {
		const html = sanitizeEmailHtml(`
			<p style="background: url(https://tracker.test/pixel)">tracked</p>
			<p style="position: fixed; inset: 0">overlay</p>
			<p style="font-weight: bold">kept</p>
		`);

		expect(html).not.toContain('tracker.test');
		expect(html).not.toContain('position: fixed');
		expect(html).toContain('style="font-weight: bold"');
	});

	it('renders Telegram previews without executable HTML or unescaped text', () => {
		const htmlPage = emailHtmlTemplate(
			'<p>Message</p><img src=x onerror="alert(1)"><script>alert(1)</script>',
			'https://assets.test'
		);
		const textPage = emailTextTemplate('<img src=x onerror="alert(1)">');

		expect(htmlPage).not.toMatch(/onerror|<script/i);
		expect(htmlPage).toContain('<p>Message</p>');
		expect(textPage).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
		expect(textPage).not.toContain('<img src=x');
	});
});
