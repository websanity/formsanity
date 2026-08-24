import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/demos/submission.html'); });

test('freeform field outside the grammar gets row states and an in-wrapper bubble', async ({ page }) => {
	const wrapper = page.locator('[data-fs-field]:has(#promo)');
	await page.locator('#promo').pressSequentially('promo!');
	await expect(wrapper).toHaveClass(/fs-invalid/);
	await expect(wrapper.locator('.fs-error')).toHaveCount(1);
	await expect(wrapper.locator('.fs-error')).toContainText('letters/numbers only');
});

test('optional freeform and compound fields do not block the gate', async ({ page }) => {
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

test('compound row reflects the worst member verdict and keeps per-control bubbles', async ({ page }) => {
	const row = page.locator('li:has(#first-name)');
	await page.locator('#first-name').fill('a1');
	await expect(row).toHaveClass(/fs-invalid/);
	await expect(row.locator('.fs-error')).toHaveCount(1);
	await expect(row.locator('.fs-error')).toContainText('letters only');
	await expect(page.locator('#last-name')).not.toHaveAttribute('aria-invalid');

	// Settling the (valid) sibling must not blank out the row's still-invalid
	// state, nor steal/clear the invalid sibling's bubble — a naive
	// "last writer wins" row-class update, or an unscoped bubble lookup,
	// would let this pass incoherently.
	await page.locator('#last-name').fill('Doe');
	await page.locator('#last-name').blur();
	await expect(row).toHaveClass(/fs-invalid/);
	await expect(row.locator('.fs-error')).toHaveCount(1);
	await expect(row.locator('.fs-error')).toContainText('letters only');
	await expect(page.locator('#last-name')).not.toHaveAttribute('aria-invalid');
});

test('data-fs-error-to renders the bubble in the designated element, not the row', async ({ page }) => {
	const wrapper = page.locator('[data-fs-field]:has(#referral)');
	await page.locator('#referral').pressSequentially('ref!');
	await expect(wrapper.locator('.fs-error')).toHaveCount(0);
	await expect(page.locator('#referral-errors .fs-error')).toHaveCount(1);
	await expect(page.locator('#referral-errors')).toContainText('letters/numbers only');
});
