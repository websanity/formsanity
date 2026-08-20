import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/types.html'); });

test('zip dead-end flags immediately', async ({ page }) => {
	await page.locator('#zip').pressSequentially('80a');
	await expect(page.locator('li:has(#zip)')).toHaveClass(/fs-invalid/);
});

test('zip incomplete waits for blur', async ({ page }) => {
	await page.locator('#zip').pressSequentially('802');
	await expect(page.locator('li:has(#zip) .fs-error')).toHaveCount(0);
	await page.locator('#zip').blur();
	await expect(page.locator('li:has(#zip) .fs-error')).toContainText('#####');
});

test('credit-card respects the network param', async ({ page }) => {
	await page.locator('#card').fill('378282246310005');
	await page.locator('#card').blur();
	await expect(page.locator('li:has(#card) .fs-error')).toContainText('Visa');
});
