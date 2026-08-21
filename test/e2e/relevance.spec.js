import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/relevance.html'); });

test('hidden until relevant, then validated', async ({ page }) => {
	const row = page.locator('li:has(#other-color)');
	await expect(row).toBeHidden();
	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).toHaveClass(/fs-incomplete/);
});

test('disabled mode disables instead of hiding', async ({ page }) => {
	await expect(page.locator('#shipping-notes')).toBeDisabled();
	await page.locator('#ship').check();
	await expect(page.locator('#shipping-notes')).toBeEnabled();
});

test('irrelevant fields hide and disable; relevant fields re-enable and show', async ({ page }) => {
	const row = page.locator('li:has(#other-color)');
	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).not.toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeEnabled();

	await page.locator('#color').selectOption('Red');
	await expect(row).toBeHidden();
	await expect(row).toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeDisabled();

	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).not.toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeEnabled();
});
