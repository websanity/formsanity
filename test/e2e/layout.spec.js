import { test, expect } from '@playwright/test';

test('wide field group puts labels left in an aligned column', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/demos/layout.html');
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
	await page.goto('/demos/layout.html');
	const row = page.locator('form[data-fs-form] li').first();
	const lb = await row.locator('label').boundingBox();
	const ib = await row.locator('input').boundingBox();
	expect(lb.y + lb.height).toBeLessThanOrEqual(ib.y);
});

test('cols group is multi-column when wide', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/demos/types.html');
	const group = page.locator('.fs-cols').first();
	await expect(group).toHaveCSS('grid-template-columns', /\d+.*\d+/);
});

test('fs-col-start splits the group into two stacked columns', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/demos/types.html');
	const rows = page.locator('.fs-cols > li');
	const first = await rows.first().boundingBox();
	const lastBeforeBreak = await page.locator('.fs-cols > li:has(+ li.fs-col-start)').boundingBox();
	const breakRow = await page.locator('.fs-cols > li.fs-col-start').boundingBox();
	const afterBreak = await page.locator('.fs-cols > li.fs-col-start + li').boundingBox();

	// The break starts a second column, level with the top of the first.
	expect(breakRow.x).toBeGreaterThan(first.x + first.width);
	expect(breakRow.y).toBe(first.y);
	// Rows on either side of the break stack under their own column.
	expect(lastBeforeBreak.x).toBe(first.x);
	expect(lastBeforeBreak.y).toBeGreaterThan(first.y);
	expect(afterBreak.x).toBe(breakRow.x);
	expect(afterBreak.y).toBeGreaterThan(breakRow.y);
});

test('fs-col-start collapses with the rest of the group when narrow', async ({ page }) => {
	await page.setViewportSize({ width: 420, height: 800 });
	await page.goto('/demos/types.html');
	const rows = page.locator('.fs-cols > li');
	const first = await rows.first().boundingBox();
	const breakRow = await page.locator('.fs-cols > li.fs-col-start').boundingBox();
	expect(breakRow.x).toBe(first.x);
	expect(breakRow.y).toBeGreaterThan(first.y);
});

test('a group with an authored fs-col-start gets no second one from auto-balance', async ({ page }) => {
	await page.goto('/demos/comparisons.html');
	const group = page.locator('ul.fs-cols:has(> li.fs-col-start)').first();
	await expect(group.locator('> li.fs-col-start')).toHaveCount(1);
});

test('the required parade lays out paired stacked rows and paired toggles', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const multi = await page.locator('li.fs-stacked:has(#multi-select)').boundingBox();
	const bio = await page.locator('li.fs-stacked:has(#bio)').boundingBox();
	expect(Math.abs(multi.y - bio.y)).toBeLessThan(2);
	expect(bio.x).toBeGreaterThan(multi.x + multi.width - 5);
	const radios = await page.locator('fieldset.fs-toggles:has(input[name="radio-list"])').boundingBox();
	const checks = await page.locator('fieldset.fs-toggles:has(input[name="checkbox-list"])').boundingBox();
	expect(Math.abs(radios.y - checks.y)).toBeLessThan(2);
	expect(checks.x).toBeGreaterThan(radios.x + radios.width - 5);
});

test('a paired stacked row packs its content to the top', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const label = await page.locator('li.fs-stacked:has(#bio) label').boundingBox();
	const control = await page.locator('#bio').boundingBox();
	expect(control.y - (label.y + label.height)).toBeLessThan(12);
});

test('a break-less cols group auto-balances into two stacked columns', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const rows = page.locator('fieldset:has(#col-street) ul.fs-cols > li');
	await expect(rows.nth(4)).toHaveClass(/fs-col-start/);
	const first = await rows.first().boundingBox();
	const lastLeft = await rows.nth(3).boundingBox();
	const firstRight = await rows.nth(4).boundingBox();
	expect(lastLeft.x).toBe(first.x);
	expect(firstRight.x).toBeGreaterThan(first.x + first.width);
	expect(firstRight.y).toBe(first.y);
});

test('a row toggle group puts its legend in the label column, buttons beside it', async ({ page }) => {
	await page.goto('/demos/relevance.html');
	const group = page.locator('fieldset.fs-toggles.fs-inline:has(input[name="trip-purpose"])');
	const legend = group.locator('> legend');
	const buttons = group.locator('> ul');
	const control = page.locator('#citizenship');
	const [legendBox, buttonsBox, controlBox] = await Promise.all([
		legend.boundingBox(), buttons.boundingBox(), control.boundingBox()
	]);
	// Legend beside the buttons, not above them.
	expect(legendBox.y).toBeLessThan(buttonsBox.y + buttonsBox.height);
	expect(legendBox.x + legendBox.width).toBeLessThanOrEqual(buttonsBox.x);
	// The buttons start where every other field column starts.
	expect(Math.abs(buttonsBox.x - controlBox.x)).toBeLessThan(2);
	// And a toggle row is exactly one text-field tall: both draw their
	// height from the same control-padding knob.
	const inputBox = await page.locator('#stay-length').boundingBox();
	expect(Math.abs(buttonsBox.height - inputBox.height)).toBeLessThan(1);
});

test('a stacked group keeps labels above their controls when wide', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const row = page.locator('li:has(#stacked-street)');
	const lb = await row.locator('label').boundingBox();
	const ib = await page.locator('#stacked-street').boundingBox();
	expect(lb.y + lb.height).toBeLessThanOrEqual(ib.y);
	expect(Math.abs(lb.x - ib.x)).toBeLessThan(2);
});

test('an fs-inline row inside a stacked group puts its label beside the control', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const row = page.locator('li:has(#stacked-note)');
	const lb = await row.locator('label').boundingBox();
	const ib = await page.locator('#stacked-note').boundingBox();
	expect(lb.x + lb.width).toBeLessThanOrEqual(ib.x);
	expect(lb.y).toBeLessThan(ib.y + ib.height);
});

test('a stacked fs-cols group pairs whole rows two-up, each stacking internally', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const first = await page.locator('li:has(#stacked-first)').boundingBox();
	const last = await page.locator('li:has(#stacked-last)').boundingBox();
	const email = await page.locator('li:has(#stacked-email)').boundingBox();
	// Reading-order pairs: first and last share a band, email starts the next.
	expect(Math.abs(first.y - last.y)).toBeLessThan(2);
	expect(last.x).toBeGreaterThan(first.x + first.width - 5);
	expect(Math.abs(email.x - first.x)).toBeLessThan(2);
	expect(email.y).toBeGreaterThan(first.y);
	// And each cell stacks its own label.
	const lb = await page.locator('li:has(#stacked-first) label').boundingBox();
	const ib = await page.locator('#stacked-first').boundingBox();
	expect(lb.y + lb.height).toBeLessThanOrEqual(ib.y);
});

test('fs-stacked on the form cascades to every group; fs-inline on a group opts back out', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/layout.html');
	const label = page.locator('li:has(#layout-motto) label');
	const beside = async () => {
		const lb = await label.boundingBox();
		const ib = await page.locator('#layout-motto').boundingBox();
		return lb.x + lb.width <= ib.x;
	};
	expect(await beside()).toBe(true);
	await page.evaluate(() => document.querySelector('form[data-fs-form]').classList.add('fs-stacked'));
	expect(await beside()).toBe(false);
	await page.evaluate(() => document.querySelector('li:has(#layout-motto)').closest('ul').classList.add('fs-inline'));
	expect(await beside()).toBe(true);
});

test('a stacked-group textarea fills its row, matching the explicit stacked pair', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 900 });
	await page.goto('/demos/required.html');
	const bio = await page.locator('#bio').boundingBox();
	const bioRow = await page.locator('li:has(#bio)').boundingBox();
	const multiRow = await page.locator('li:has(#multi-select)').boundingBox();
	expect(Math.abs(bioRow.height - multiRow.height)).toBeLessThan(2);
	expect(bioRow.y + bioRow.height - (bio.y + bio.height)).toBeLessThan(6);
});
