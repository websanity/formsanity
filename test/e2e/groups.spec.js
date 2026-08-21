import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/choice-groups.html'); });

test('at-least-one satisfied by any member', async ({ page }) => {
	const rows = page.locator('li:has([data-fs-group-at-least-one="contact"])');
	await expect(rows.first()).toHaveClass(/fs-incomplete/);
	await page.locator('#contact-phone').fill('(303) 555-1234');
	await expect(rows.first()).toHaveClass(/fs-valid/);
});

test('max-selected is immediate', async ({ page }) => {
	const boxes = page.locator('input[name="toppings"]');
	await boxes.nth(0).check();
	await boxes.nth(1).check();
	await boxes.nth(2).check();
	await expect(page.locator('fieldset:has(input[name="toppings"]) .fs-error')).toContainText('at most 2');
});

test('unique-in-page', async ({ page }) => {
	await page.locator('#ref-one').fill('same@x.co');
	await page.locator('#ref-two').fill('same@x.co');
	await page.locator('#ref-two').blur();
	await expect(page.locator('li:has(#ref-two) .fs-error')).toContainText('unique');
});
