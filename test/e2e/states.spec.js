import { test, expect } from '@playwright/test';

test('not-valid rows show the label asterisk', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const label = page.locator('li.fs-incomplete label').first();
	const content = await label.evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
	expect(content).toContain('svg');
});

test('error bubble is styled as a bubble', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	await page.locator('#email').fill('a@@b');
	const bubble = page.locator('li:has(#email) .fs-error');
	await expect(bubble).toBeVisible();
	const radius = await bubble.evaluate((el) => getComputedStyle(el).borderRadius);
	expect(radius).not.toBe('0px');
});

test('toggle buttons render as buttons', async ({ page }) => {
	await page.goto('/instrumentation/choice-groups.html');
	const label = page.locator('.toggle-list.buttons li label').first();
	const display = await label.evaluate((el) => getComputedStyle(el).display);
	expect(display).not.toBe('inline');
});
