import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/choice-groups.html'); });

test('required-any satisfied by any member', async ({ page }) => {
	const rows = page.locator('li:has([data-fs-group-required-any="contact"])');
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

test('group-unique-values', async ({ page }) => {
	await page.locator('#ref-one').fill('same@x.co');
	await page.locator('#ref-two').fill('same@x.co');
	await page.locator('#ref-two').blur();
	await expect(page.locator('li:has(#ref-two) .fs-error')).toContainText('unique');
});

test('requiredness stays asterisk-quiet: no bubbles on blur for required-any or min-selected', async ({ page }) => {
	const row = page.locator('li:has(#contact-email)');
	await page.locator('#contact-email').focus();
	await page.locator('#contact-email').blur();
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
	const toppings = page.locator('fieldset:has(input[name="toppings"])');
	const first = page.locator('input[name="toppings"]').first();
	await first.check();
	await first.uncheck();
	await page.locator('#contact-phone').focus();
	await expect(toppings).toHaveClass(/fs-incomplete/);
	await expect(toppings.locator('.fs-error')).toHaveCount(0);
});

test('min-selected counts a multi-select list', async ({ page }) => {
	const row = page.locator('li:has(#sizes)');
	await page.locator('#sizes').selectOption(['Small']);
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
	await page.locator('#sizes').selectOption(['Small', 'Large']);
	await expect(row).toHaveClass(/fs-valid/);
});
