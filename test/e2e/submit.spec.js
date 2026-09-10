import { test, expect } from '@playwright/test';

async function complete(page) {
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
}

test('accepted submission shows the server message', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
});

test('rejection maps server errors onto fields', async ({ page }) => {
	await page.goto('/demos/submission.html?scenario=invalid');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
	// A rejected field is a wrong answer: the standing invalid line shows
	// and the gate closes until it is fixed.
	await expect(page.locator('.fs-status .fs-status-invalid')).toBeVisible();
	await expect(page.locator('.fs-status .fs-status-invalid')).toContainText('Please fix the highlighted fields');
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await page.locator('#email').fill('fresh@example.com');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

test('redirect follows', async ({ page }) => {
	await page.goto('/demos/submission.html?scenario=redirect');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/submitted\.html/);
});

test('pre-submit hook fields are merged', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body.token).toBe('tok_123');
	expect(body.csrf).toBe('demo-token');
});

test('unique check marks the field from the server', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.locator('#email').fill('taken@example.com');
	await page.locator('#email').blur();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});

test('irrelevant fields are omitted from the submission', async ({ page }) => {
	await page.goto('/demos/relevance.html');
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	// The journal set is required (one member carries required), so an always-relevant member is chosen; the set is unrelated to what this test checks.
	await page.locator('input[name="journal"][value="Online"]').check();
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body).not.toHaveProperty('other-color');
});

test('rapid double-click submits only once', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	let submitCount = 0;
	page.on('request', (request) => {
		if (request.url().includes('/api/submit')) submitCount += 1;
	});
	// Two synchronous DOM .click() calls in one page.evaluate — bypasses
	// Playwright's actionability auto-wait so both 'submit' events fire back
	// to back, before any async work from the first click has resolved.
	await page.evaluate(() => {
		const button = document.querySelector('button[type="submit"]');
		button.click();
		button.click();
	});
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
	expect(submitCount).toBe(1);
});

test('a multi-select submits every selected value as an array', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
	await page.locator('#colors').selectOption(['Red', 'Blue']);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	expect((await posted).postDataJSON().colors).toEqual(['Red', 'Blue']);
});

test('a multipart body names the parts of an array-valued field with the [] suffix', async ({ page }) => {
	await page.goto('/test/fixtures/multipart.html');
	await page.locator('#city').fill('Boston');
	await page.locator('input[name="colors"][value="Red"]').check();
	await page.locator('input[name="colors"][value="Blue"]').check();
	await page.locator('#sizes').selectOption(['S', 'L']);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const request = await posted;
	expect(request.headers()['content-type']).toMatch(/^multipart\/form-data/);
	const body = request.postDataBuffer().toString('latin1');
	expect(body.match(/name="colors\[\]"/g)).toHaveLength(2);
	expect(body.match(/name="sizes\[\]"/g)).toHaveLength(2);
	expect(body.match(/name="city"/g)).toHaveLength(1);
	expect(body).not.toMatch(/name="colors"/);
	expect(body).not.toMatch(/name="attachment/);
});
