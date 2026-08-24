import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/relevance.html'); });

test('hidden until relevant, then validated', async ({ page }) => {
	const row = page.locator('li:has(#other-color)');
	await expect(row).toBeHidden();
	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).toHaveClass(/fs-incomplete/);
});

test('disabled mode disables instead of hiding', async ({ page }) => {
	await expect(page.locator('#shipping-street')).toBeDisabled();
	await expect(page.locator('#shipping-street')).toBeVisible();
	await page.locator('#same-as-billing').uncheck();
	await expect(page.locator('#shipping-street')).toBeEnabled();
});

test('the disabled shipping address mirrors billing as it is typed', async ({ page }) => {
	await page.locator('#billing-street').pressSequentially('123 Elm St');
	await expect(page.locator('#shipping-street')).toBeDisabled();
	await expect(page.locator('#shipping-street')).toHaveValue('123 Elm St');
	await page.locator('#same-as-billing').uncheck();
	await page.locator('#shipping-street').fill('9 Oak Ave');
	await expect(page.locator('#shipping-street')).toHaveValue('9 Oak Ave');
});

test('irrelevant fields hide and disable; relevant fields re-enable and show', async ({ page }) => {
	const row = page.locator('li:has(#other-color)');
	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).not.toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeEnabled();

	await page.locator('#color').selectOption('Red');
	await expect(row).toBeHidden();
	await expect(row).toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeDisabled();

	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).not.toHaveClass(/fs-irrelevant/);
	await expect(page.locator('#other-color')).toBeEnabled();
});

test('valid() gates relevance on the source field being answered and valid', async ({ page }) => {
	await expect(page.locator('#account-confirm')).toBeDisabled();
	await page.locator('#account-password').fill('short');
	await expect(page.locator('#account-confirm')).toBeDisabled();
	await page.locator('#account-password').fill('longenough1');
	await expect(page.locator('#account-confirm')).toBeEnabled();
});

test('a region gated on a prefilled-invalid field does not load open', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await expect(page.locator('#gated-region')).toBeHidden();
	await expect(page.locator('#gated-note')).toBeDisabled();
});

test('clear-on-change wipes the dependent when the source changes', async ({ page }) => {
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	await expect(page.locator('li:has(#account-confirm)')).toHaveClass(/fs-valid/);
	await page.locator('#account-password').pressSequentially('2');
	await expect(page.locator('#account-confirm')).toHaveValue('');
});

test('the visa rule: work always, otherwise non-citizens past 90 days', async ({ page }) => {
	const row = page.locator('li:has(#visa-number)');
	await expect(row).toBeHidden();
	await page.locator('#citizenship').selectOption('CA');
	await page.locator('#stay-length').fill('120');
	await expect(row).toBeVisible();
	await page.locator('#citizenship').selectOption('US');
	await expect(row).toBeHidden();
	await page.locator('input[name="trip-purpose"][value="work"]').check();
	await expect(row).toBeVisible();
});

test('a container region toggles all fields inside it', async ({ page }) => {
	const cardRow = page.locator('li:has(#card-number)');
	await expect(cardRow).toBeHidden();
	await page.locator('input[name="pay-method"][value="card"]').check();
	await expect(cardRow).toBeVisible();
	await expect(page.locator('#card-number')).toBeEnabled();
	await page.locator('input[name="pay-method"][value="invoice"]').check();
	await expect(cardRow).toBeHidden();
	await expect(page.locator('#card-number')).toBeDisabled();
});

test('a fieldless region shows and hides plain text', async ({ page }) => {
	const note = page.locator('#invoice-note');
	await expect(note).toBeHidden();
	await page.locator('input[name="pay-method"][value="invoice"]').check();
	await expect(note).toBeVisible();
	await page.locator('input[name="pay-method"][value="card"]').check();
	await expect(note).toBeHidden();
});

test('a required field inside an irrelevant region does not hold the gate', async ({ page }) => {
	await page.locator('input[name="pay-method"][value="card"]').check();
	await page.locator('#card-number').pressSequentially('4111');
	await expect(page.locator('li:has(#card-number)')).toHaveClass(/fs-incomplete/);
	await page.locator('input[name="pay-method"][value="invoice"]').check();
	await expect(page.locator('li:has(#card-number)')).not.toHaveClass(/fs-incomplete/);
});
