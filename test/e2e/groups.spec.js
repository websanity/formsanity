import { test, expect } from '@playwright/test';

test('required-any satisfied by any member', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const rows = page.locator('li:has([data-fs-group-required-any="tickets"])');
	await expect(rows.first()).toHaveClass(/fs-incomplete/);
	await page.locator('#box-seats').fill('2');
	await expect(rows.first()).toHaveClass(/fs-valid/);
});

test('max-selected is immediate', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const boxes = page.locator('input[name="check-three-max"]');
	await boxes.nth(0).check();
	await boxes.nth(1).check();
	await boxes.nth(2).check();
	await boxes.nth(3).check();
	await expect(page.locator('fieldset.toggle-list:has(input[name="check-three-max"]) .fs-error')).toContainText('at most 3');
});

test('group-unique-values flags a duplicate on commit', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#first-choice').selectOption('Option one');
	await page.locator('#second-choice').selectOption('Option one');
	await expect(page.locator('li:has(#second-choice) .fs-error')).toContainText('unique');
});

test('requiredness stays asterisk-quiet: no bubbles on blur for required-any or min-selected', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const row = page.locator('li:has(#club-seats)');
	await page.locator('#club-seats').focus();
	await page.locator('#club-seats').blur();
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
	const list = page.locator('fieldset.toggle-list:has(input[name="checkbox-list"])');
	const first = page.locator('input[name="checkbox-list"]').first();
	await first.check();
	await first.uncheck();
	await page.locator('#club-seats').focus();
	await expect(list).toHaveClass(/fs-incomplete/);
	await expect(list.locator('.fs-error')).toHaveCount(0);
});

test('min-selected counts a multi-select list', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const row = page.locator('li:has(#select-three-plus)');
	await page.locator('#select-three-plus').selectOption(['Cras aliquam massa ullamcorper sapien']);
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
	await page.locator('#select-three-plus').selectOption([
		'Cras aliquam massa ullamcorper sapien',
		'Cras rutrum pulvinar tellus',
		'Vivamus convallis urna id felis'
	]);
	await expect(row).toHaveClass(/fs-valid/);
});
