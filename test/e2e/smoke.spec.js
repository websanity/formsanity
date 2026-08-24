import { test, expect } from '@playwright/test';

test('index page initializes FormSanity', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const form = page.locator('form[data-fs-form]');
	await expect(form).toHaveAttribute('novalidate', '');
	await expect(form).toHaveClass(/fs-form/);
});

test('a malformed expression degrades to an inert rule without aborting init', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error));
	await page.goto('/test/fixtures/edge-cases.html');
	await expect(page.locator('#edge-cases')).toHaveClass(/fs-form/);
	await expect(page.locator('#after-edge-cases')).toHaveClass(/fs-form/);
	expect(errors).toEqual([]);
});
