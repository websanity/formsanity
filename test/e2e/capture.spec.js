import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { parseMultipart } from '../server.js';

// Records what the client posts for three pages, so the PHP implementation can replay the bodies. Runs only under CAPTURE=1, because it writes files.
test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to record fixtures');

const out = new URL('../../php/tests/fixtures/', import.meta.url);

function record(name, page, request) {
	mkdirSync(out, { recursive: true });
	const contentType = request.headers()['content-type'] ?? '';
	let payload;
	const files = {};
	if (contentType.startsWith('application/json')) {
		payload = request.postDataJSON();
	} else {
		const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
		const body = request.postDataBuffer().toString('latin1');
		payload = parseMultipart(body, boundary[1] ?? boundary[2]);
		for (const [key, value] of Object.entries(payload)) {
			const names = Array.isArray(value) ? value : [value];
			if (!names.some((v) => /\.(pdf|png|jpg)$/i.test(v))) continue;
			files[key] = { name: names, type: names.map(() => 'application/pdf'), size: names.map(() => 8), tmp_name: names.map(() => ''), error: names.map(() => 0) };
			delete payload[key];
		}
	}
	writeFileSync(new URL(`${name}.json`, out), JSON.stringify({ page, contentType, payload, files }, null, '\t') + '\n');
}

test('submission page', async ({ page }) => {
	await page.goto('/demos/submission.html');
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	record('submission', '/demos/submission.html', await posted);
});

test('relevance page', async ({ page }) => {
	await page.goto('/demos/relevance.html');
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	await page.locator('input[name="member-type"][value="Standard"]').check();
	await page.locator('input[name="journal"][value="Standard Print"]').check();
	await page.locator('input[name="directory"][value="name"]').check();
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	record('relevance', '/demos/relevance.html', await posted);
});

test('multipart fixture', async ({ page }) => {
	let request = null;
	await page.route('**/api/submit*', async (route) => { request = route.request(); await route.continue(); });
	await page.goto('/test/fixtures/multipart.html');
	await page.locator('#city').fill('Boston');
	await page.locator('input[name="colors"][value="Red"]').check();
	await page.locator('#gift').check();
	const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
	await page.locator('#photo').setInputFiles(pdf('photo.pdf'));
	await page.locator('#attachment').setInputFiles([pdf('a.pdf'), pdf('b.pdf')]);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	await posted;
	expect(request).not.toBeNull();
	record('multipart', '/test/fixtures/multipart.html', request);
});
