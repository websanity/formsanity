import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/index.html'); });

test('gate disables submit and shows the incomplete message', async ({ page }) => {
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await expect(page.locator('.fs-status-incomplete')).toBeVisible();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

test('invalid values show the invalid message separately', async ({ page }) => {
	await page.locator('#age').fill('200');
	await expect(page.locator('.fs-status-invalid')).toBeVisible();
});

test('completing the form releases the gate and clears messages', async ({ page }) => {
	await page.locator('#full-name').fill('Jans Carton');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#age').fill('44');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
	await expect(page.locator('.fs-status-incomplete')).toBeHidden();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

test('when-valid element reacts', async ({ page }) => {
	await expect(page.locator('#ready-note')).toBeHidden();
	await page.locator('#full-name').fill('Jans Carton');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#age').fill('44');
	await expect(page.locator('#ready-note')).toBeVisible();
});
