import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/operations.html'); });

test('copy-to mirrors', async ({ page }) => {
	await page.locator('#billing-name').fill('Jans');
	await expect(page.locator('#shipping-name')).toHaveValue('Jans');
});

test('amounts sum into the total', async ({ page }) => {
	await page.locator('#donation').fill('25');
	await page.locator('#fee').fill('1.50');
	await expect(page.locator('#total')).toHaveText('26.50');
});

test('year options generate from offsets', async ({ page }) => {
	const year = new Date().getFullYear();
	const options = page.locator('#card-year option');
	await expect(options.nth(1)).toHaveText(String(year));
	await expect(options.last()).toHaveText(String(year + 5));
});

test('reveal toggles the password field', async ({ page }) => {
	await expect(page.locator('#password')).toHaveAttribute('type', 'password');
	await page.locator('li:has(#password) .fs-reveal').click();
	await expect(page.locator('#password')).toHaveAttribute('type', 'text');
});

test('counter counts down', async ({ page }) => {
	await page.locator('#bio').fill('12345');
	await expect(page.locator('li:has(#bio) .fs-counter')).toHaveText('45 characters remaining');
});

test('a form-control amount total is reconciled with the engine at load', async ({ page }) => {
	await expect(page.locator('#total-input')).toHaveValue('0.00');
	await expect(page.locator('#operations-edge-cases button[type="submit"]')).toBeEnabled();
});

test('copy-to cycle terminates without throwing', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error));
	await page.locator('#cycle-a').fill('x');
	await expect(page.locator('#cycle-b')).toHaveValue('x');
	expect(errors).toEqual([]);
});
