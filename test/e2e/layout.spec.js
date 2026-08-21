import { test, expect } from '@playwright/test';

test('wide field group puts labels left in an aligned column', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/instrumentation/index.html');
	const row = page.locator('form[data-fs-form] li').first();
	await expect(row).toHaveCSS('display', 'grid');
	const label = row.locator('label');
	const input = row.locator('input');
	const lb = await label.boundingBox();
	const ib = await input.boundingBox();
	expect(lb.x + lb.width).toBeLessThanOrEqual(ib.x);
});

test('narrow container stacks labels on top', async ({ page }) => {
	await page.setViewportSize({ width: 420, height: 800 });
	await page.goto('/instrumentation/index.html');
	const row = page.locator('form[data-fs-form] li').first();
	const lb = await row.locator('label').boundingBox();
	const ib = await row.locator('input').boundingBox();
	expect(lb.y + lb.height).toBeLessThanOrEqual(ib.y);
});

test('cols group is multi-column when wide', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/instrumentation/types.html');
	const group = page.locator('.cols').first();
	await expect(group).toHaveCSS('grid-template-columns', /\d+.*\d+/);
});

test('col-break splits the group into two stacked columns', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/instrumentation/types.html');
	const rows = page.locator('.cols > li');
	const first = await rows.first().boundingBox();
	const lastBeforeBreak = await rows.nth(7).boundingBox();
	const breakRow = await page.locator('.cols > li.col-break').boundingBox();
	const afterBreak = await rows.nth(9).boundingBox();

	// The break starts a second column, level with the top of the first.
	expect(breakRow.x).toBeGreaterThan(first.x + first.width);
	expect(breakRow.y).toBe(first.y);
	// Rows on either side of the break stack under their own column.
	expect(lastBeforeBreak.x).toBe(first.x);
	expect(lastBeforeBreak.y).toBeGreaterThan(first.y);
	expect(afterBreak.x).toBe(breakRow.x);
	expect(afterBreak.y).toBeGreaterThan(breakRow.y);
});

test('col-break collapses with the rest of the group when narrow', async ({ page }) => {
	await page.setViewportSize({ width: 420, height: 800 });
	await page.goto('/instrumentation/types.html');
	const rows = page.locator('.cols > li');
	const first = await rows.first().boundingBox();
	const breakRow = await page.locator('.cols > li.col-break').boundingBox();
	expect(breakRow.x).toBe(first.x);
	expect(breakRow.y).toBeGreaterThan(first.y);
});
