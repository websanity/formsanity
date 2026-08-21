import { test, expect } from '@playwright/test';

test('confirm mismatch is a dead end when not a prefix', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hx');
	await expect(page.locator('li:has(#confirm)')).toHaveClass(/fs-invalid/);
});

test('confirm prefix stays quiet until blur', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hun');
	await expect(page.locator('li:has(#confirm) .fs-error')).toHaveCount(0);
});

test('date comparison is chronological with date wording', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#start').fill('2026-09-01');
	await page.locator('#end').fill('2026-08-01');
	await page.locator('#end').blur();
	await expect(page.locator('li:has(#end) .fs-error')).toContainText('after');
});

test('password composition counts character classes', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#new-password').fill('alllowercase1');
	await page.locator('#new-password').blur();
	await expect(page.locator('li:has(#new-password) .fs-error')).toContainText('uppercase');
});

test('file size cap', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#attachment').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3 * 1024 * 1024) });
	await expect(page.locator('li:has(#attachment)')).toHaveClass(/fs-invalid/);
});

test('duration bounds compare in duration order end to end', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const range = page.locator('#duration-range');
	await range.fill('1:30');
	await range.blur();
	await expect(page.locator('li:has(#duration-range) .fs-error')).toContainText('minimum of 2:00');
	await range.fill('6:00');
	await expect(page.locator('li:has(#duration-range)')).toHaveClass(/fs-invalid/);
	await expect(page.locator('li:has(#duration-range) .fs-error')).toContainText('maximum of 5:00');
	await range.fill('3:00');
	await expect(page.locator('li:has(#duration-range)')).toHaveClass(/fs-valid/);
});

test('a dollar minimum reads the dollar format', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#donation').fill('4');
	await page.locator('#donation').blur();
	await expect(page.locator('li:has(#donation) .fs-error')).toContainText('minimum of $5.00');
});

test('a reversed native time range wraps midnight', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#overnight').fill('23:00');
	await expect(page.locator('li:has(#overnight)')).toHaveClass(/fs-valid/);
	await page.locator('#overnight').fill('12:00');
	await expect(page.locator('li:has(#overnight)')).toHaveClass(/fs-(incomplete|invalid)/);
});
