import { test, expect } from '@playwright/test';

test('index page initializes FormSanity', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const form = page.locator('form[data-fs-form]');
	await expect(form).toHaveAttribute('novalidate', '');
	await expect(form).toHaveClass(/fs-form/);
});
