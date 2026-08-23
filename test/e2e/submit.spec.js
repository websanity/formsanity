import { test, expect } from '@playwright/test';

async function complete(page) {
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
}

test('accepted submission shows the server message', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
});

test('rejection maps server errors onto fields', async ({ page }) => {
	await page.goto('/instrumentation/submission.html?scenario=invalid');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});

test('redirect follows', async ({ page }) => {
	await page.goto('/instrumentation/submission.html?scenario=redirect');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/submitted\.html/);
});

test('pre-submit hook fields are merged', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await complete(page);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body.token).toBe('tok_123');
	expect(body.csrf).toBe('demo-token');
});

test('unique check marks the field from the server', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await page.locator('#email').fill('taken@example.com');
	await page.locator('#email').blur();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});

test('irrelevant fields are omitted from the submission', async ({ page }) => {
	await page.goto('/instrumentation/relevance.html');
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body).not.toHaveProperty('other-color');
});

test('rapid double-click submits only once', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
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
	await page.goto('/instrumentation/submission.html');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
	await page.locator('#colors').selectOption(['Red', 'Blue']);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	expect((await posted).postDataJSON().colors).toEqual(['Red', 'Blue']);
});
