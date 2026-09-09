import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/demos/relevance.html'); });

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

test('a checkbox set compares as its checked values joined with commas', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await expect(page.locator('#editor-note')).toBeDisabled();
	await expect(page.locator('#non-editor-note')).toBeEnabled();

	await page.locator('input[name="site-roles"][value="Editor"]').check();
	await expect(page.locator('#editor-note')).toBeEnabled();
	await expect(page.locator('#non-editor-note')).toBeDisabled();

	// With both boxes checked the set reads 'Editor,Reviewer', which equals neither value alone.
	await page.locator('input[name="site-roles"][value="Reviewer"]').check();
	await expect(page.locator('#editor-note')).toBeDisabled();
	await expect(page.locator('#non-editor-note')).toBeEnabled();
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

test('a member hides and shows on its own expression', async ({ page }) => {
	const standard = page.locator('input[name="journal"][value="Standard Print"]');
	const standardRow = page.locator('li:has(> label > input[name="journal"][value="Standard Print"])');
	const student = page.locator('input[name="journal"][value="Reduced-cost Print"]');
	const online = page.locator('input[name="journal"][value="Online"]');
	await expect(standard).toBeDisabled();
	await expect(standardRow).toBeHidden();
	await expect(standardRow).toHaveClass(/fs-irrelevant/);
	await expect(online).toBeEnabled();

	await page.locator('input[name="member-type"][value="Standard"]').check();
	await expect(standard).toBeEnabled();
	await expect(standardRow).toBeVisible();
	await expect(standardRow).not.toHaveClass(/fs-irrelevant/);
	await expect(student).toBeDisabled();

	await page.locator('input[name="member-type"][value="Student"]').check();
	await expect(standard).toBeDisabled();
	await expect(student).toBeEnabled();
});

test('a checked member that goes irrelevant keeps its state and comes back', async ({ page }) => {
	const email = page.locator('input[name="directory"][value="email"]');
	await expect(email).toBeChecked();
	await expect(email).toBeDisabled();

	await page.locator('#directory-listed').check();
	await expect(email).toBeEnabled();
	await expect(email).toBeChecked();

	await page.locator('#directory-listed').uncheck();
	await expect(email).toBeDisabled();
	await expect(email).toBeChecked();
});

test('a partly relevant set submits its relevant members only', async ({ page }) => {
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	await page.locator('input[name="member-type"][value="Standard"]').check();
	await page.locator('input[name="journal"][value="Standard Print"]').check();
	await page.locator('input[name="directory"][value="name"]').check();
	// Email is checked in the markup but irrelevant while the directory box is unchecked.
	const posted = page.waitForRequest((request) => request.url().endsWith('/api/submit') && request.method() === 'POST');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body.directory).toEqual(['name']);
	expect(body.journal).toEqual(['Standard Print']);
});

test('two members of one set exclude each other in disabled mode', async ({ page }) => {
	const head = page.locator('input[name="facility-roles"][value="Head Manager"]');
	const manager = page.locator('input[name="facility-roles"][value="Manager"]');
	await expect(head).toBeEnabled();
	await expect(manager).toBeEnabled();
	await head.check();
	await expect(manager).toBeDisabled();
	await expect(manager).toBeVisible();
	await head.uncheck();
	await expect(manager).toBeEnabled();
	await manager.check();
	await expect(head).toBeDisabled();
});
