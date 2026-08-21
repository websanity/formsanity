import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/operations.html'); });

test('copy-to mirrors', async ({ page }) => {
	await page.locator('#billing-name').fill('Jans');
	await expect(page.locator('#shipping-name')).toHaveValue('Jans');
});

test('amounts sum into the total', async ({ page }) => {
	await page.locator('#donation').fill('25');
	await page.locator('#fee').fill('1.50');
	await expect(page.locator('#total')).toHaveText('26.50');
});

test('year options generate from offsets', async ({ page }) => {
	const year = new Date().getFullYear();
	const options = page.locator('#card-year option');
	await expect(options.nth(1)).toHaveText(String(year));
	await expect(options.last()).toHaveText(String(year + 5));
});

test('reveal toggles the password field', async ({ page }) => {
	await expect(page.locator('#password')).toHaveAttribute('type', 'password');
	await page.locator('li:has(#password) .fs-reveal').click();
	await expect(page.locator('#password')).toHaveAttribute('type', 'text');
});

test('counter counts down', async ({ page }) => {
	await page.locator('#bio').fill('12345');
	await expect(page.locator('li:has(#bio) .fs-counter')).toHaveText('45 characters remaining');
});

test('a form-control amount total is reconciled with the engine at load', async ({ page }) => {
	await expect(page.locator('#total-input')).toHaveValue('0.00');
	await expect(page.locator('#operations-edge-cases button[type="submit"]')).toBeEnabled();
});

// Regression: an unchecked member of a priced choice set used to contribute
// its value attribute to the total, so all three tiers summed at once (80 + 30
// + 0 + the 45 banquet = 155) no matter which one was picked. A term's value
// follows the same rule an expression reads it by — an unchecked toggle is ''.
test('an unchecked priced choice contributes nothing to the total', async ({ page }) => {
	await expect(page.locator('#conditional-total')).toHaveText('125.00');
	await page.locator('input[name="tier"][value="30"]').check();
	await expect(page.locator('#conditional-total')).toHaveText('75.00');
});

// Regression: an irrelevant term kept counting — its control is disabled and
// its value is never submitted, but the sum still included it, and nothing
// recomputed the total when the field driving relevance changed.
test('an irrelevant term drops out of the total', async ({ page }) => {
	await expect(page.locator('#conditional-total')).toHaveText('125.00');
	await page.locator('input[name="tier"][value="0"]').check();
	await expect(page.locator('#banquet')).toBeDisabled();
	await expect(page.locator('#conditional-total')).toHaveText('0.00');
});

// Regression: gather() already skips a field whose first control is
// author-disabled, but updateFormState and validateAll used to validate and
// count it anyway — a server-prefilled disabled field with an invalid-looking
// value wedged the gate for a field that could never actually submit.
test('an author-disabled prefilled field with an invalid value does not hold the gate', async ({ page }) => {
	await expect(page.locator('#disabled-prefilled')).toBeDisabled();
	await expect(page.locator('#disabled-prefilled')).toHaveValue('not-an-email@@bad');
	await expect(page.locator('#operations-edge-cases button[type="submit"]')).toBeEnabled();
	await expect(page.locator('#operations-edge-cases .fs-status-invalid')).toBeHidden();
});

test('copy-to cycle terminates without throwing', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error));
	await page.locator('#cycle-a').fill('x');
	await expect(page.locator('#cycle-b')).toHaveValue('x');
	expect(errors).toEqual([]);
});

test('the reveal button renders as a suffix cap', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await expect(page.locator('.fs-caps:has(#password) > button.fs-reveal')).toBeVisible();
});
