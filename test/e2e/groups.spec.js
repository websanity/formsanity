import { test, expect } from '@playwright/test';

test('required-any satisfied by any member', async ({ page }) => {
	await page.goto('/demos/required.html');
	const rows = page.locator('li:has([data-fs-group-required-any="tickets"])');
	await expect(rows.first()).toHaveClass(/fs-incomplete/);
	await page.locator('#box-seats').fill('2');
	await expect(rows.first()).toHaveClass(/fs-valid/);
});

test('max-selected is immediate', async ({ page }) => {
	await page.goto('/demos/limits.html');
	const boxes = page.locator('input[name="check-three-max"]');
	await boxes.nth(0).check();
	await boxes.nth(1).check();
	await boxes.nth(2).check();
	await boxes.nth(3).check();
	await expect(page.locator('fieldset.fs-toggles:has(input[name="check-three-max"]) .fs-error')).toContainText('at most 3');
});

test('group-unique-values flags a duplicate on commit', async ({ page }) => {
	await page.goto('/demos/comparisons.html');
	await page.locator('#first-choice').selectOption('Option one');
	await page.locator('#second-choice').selectOption('Option one');
	await expect(page.locator('li:has(#second-choice) .fs-error')).toContainText('unique');
});

test('requiredness stays asterisk-quiet: no bubbles on blur for required-any or min-selected', async ({ page }) => {
	await page.goto('/demos/required.html');
	const row = page.locator('li:has(#club-seats)');
	await page.locator('#club-seats').focus();
	await page.locator('#club-seats').blur();
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
	const list = page.locator('fieldset.fs-toggles:has(input[name="checkbox-list"])');
	const first = page.locator('input[name="checkbox-list"]').first();
	await first.check();
	await first.uncheck();
	await page.locator('#club-seats').focus();
	await expect(list).toHaveClass(/fs-incomplete/);
	await expect(list.locator('.fs-error')).toHaveCount(0);
});

test('min-selected counts a multi-select list', async ({ page }) => {
	await page.goto('/demos/limits.html');
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

test('a conditionally required field is missing only while its condition holds', async ({ page }) => {
	await page.goto('/demos/required.html');
	const row = page.locator('li:has(#contact-phone)');
	await expect(row).not.toHaveClass(/fs-missing/);
	await page.locator('input[name="contact"][value="phone"]').check();
	await expect(row).toHaveClass(/fs-missing/);
	await expect(page.locator('#contact-phone')).toBeVisible();
	await expect(page.locator('#contact-phone')).toBeEnabled();
	await page.locator('input[name="contact"][value="email"]').check();
	await expect(row).not.toHaveClass(/fs-missing/);
	await page.locator('input[name="contact"][value="phone"]').check();
	await page.locator('#contact-phone').fill('303-555-0100');
	await expect(row).not.toHaveClass(/fs-missing/);
});

test('conditional requiredness never bubbles', async ({ page }) => {
	await page.goto('/demos/required.html');
	const row = page.locator('li:has(#contact-phone)');
	await page.locator('input[name="contact"][value="phone"]').check();
	await page.locator('#contact-phone').focus();
	await page.locator('#contact-phone').blur();
	await expect(row).toHaveClass(/fs-missing/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
});

test('a conditionally required set is satisfied by any checked member', async ({ page }) => {
	await page.goto('/demos/required.html');
	const group = page.locator('fieldset.fs-toggles:has(input[name="reach"])');
	await expect(group).not.toHaveClass(/fs-missing/);
	await page.locator('#contact-me').check();
	await expect(group).toHaveClass(/fs-missing/);
	await page.locator('#contact-me').uncheck();
	await expect(group).not.toHaveClass(/fs-missing/);
	await page.locator('#contact-me').check();
	await page.locator('input[name="reach"][value="call"]').check();
	await expect(group).not.toHaveClass(/fs-missing/);
});

test('native required wins over data-fs-required, and the author is told once', async ({ page }) => {
	const reports = [];
	page.on('console', (message) => { if (message.type() === 'error' && message.text().includes('newsletter-email')) reports.push(message.text()); });
	await page.goto('/test/fixtures/edge-cases.html');
	const row = page.locator('li:has(#newsletter-email)');
	await expect(row).not.toHaveClass(/fs-missing/);
	await page.locator('#newsletter-email').fill('');
	await expect(row).toHaveClass(/fs-missing/);
	await page.locator('#wants-newsletter').check();
	await expect(row).toHaveClass(/fs-missing/);
	await page.locator('#wants-newsletter').uncheck();
	await expect(row).toHaveClass(/fs-missing/);
	expect(reports).toHaveLength(1);
});

test('a malformed data-fs-required is inert', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	const row = page.locator('li:has(#mailing-note)');
	await expect(row).not.toHaveClass(/fs-missing/);
	await page.locator('#wants-newsletter').check();
	await expect(row).not.toHaveClass(/fs-missing/);
	await page.locator('#mailing-note').fill('');
	await expect(row).not.toHaveClass(/fs-missing/);
});
