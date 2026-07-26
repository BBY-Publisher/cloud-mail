import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker, { dispatchRequest } from '../src';

describe('Cloud Mail worker', () => {
	it('serves the frontend entry point (unit style)', async () => {
		const request = new Request('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(await response.text()).toContain('<title>Cloud Mail</title>');
	});

	it('serves the frontend entry point (integration style)', async () => {
		const response = await SELF.fetch('http://example.com');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(await response.text()).toContain('<title>Cloud Mail</title>');
	});

	it('keeps API routes mounted under /api without rewriting the request', async () => {
		const response = await SELF.fetch('http://example.com/api/setting/websiteConfig');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.code).not.toBe(404);
	});

	it('passes large API upload requests through without rebuilding the request body', async () => {
		const request = new Request('http://example.com/api/email/attachment/upload', {
			method: 'PUT',
			body: new Uint8Array([1, 2, 3])
		});
		const apiFetch = vi.fn(async received => {
			expect(received).toBe(request);
			return new Response('ok');
		});

		const response = await dispatchRequest(request, {}, {}, apiFetch);

		expect(await response.text()).toBe('ok');
		expect(apiFetch).toHaveBeenCalledOnce();
	});
});
