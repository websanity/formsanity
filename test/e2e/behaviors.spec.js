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
	await page.goto('/instrumentation/types.html');
	await expect(page.locator('#password')).toHaveAttribute('type', 'password');
	await page.locator('li:has(#password) .fs-reveal').click();
	await expect(page.locator('#password')).toHaveAttribute('type', 'text');
});

test('counter counts down', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#max-500-char').fill('12345');
	await expect(page.locator('li:has(#max-500-char) .fs-counter')).toHaveText('495 characters remaining');
});

test('the hidden total transport is reconciled with the engine at load', async ({ page }) => {
	await expect(page.locator('#total-transport')).toHaveValue('0.00');
	await page.locator('#donation').fill('30');
	await page.locator('#fee').fill('2.50');
	await expect(page.locator('#total-transport')).toHaveValue('32.50');
	await expect(page.locator('#total')).toHaveText('32.50');
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
	await page.goto('/test/fixtures/edge-cases.html');
	await expect(page.locator('#disabled-prefilled')).toBeDisabled();
	await expect(page.locator('#disabled-prefilled')).toHaveValue('not-an-email@@bad');
	await expect(page.locator('#edge-cases button[type="submit"]')).toBeEnabled();
	await expect(page.locator('#edge-cases .fs-status-invalid')).toBeHidden();
});

test('copy-to cycle terminates without throwing', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	const errors = [];
	page.on('pageerror', (error) => errors.push(error));
	await page.locator('#cycle-a').fill('x');
	await expect(page.locator('#cycle-b')).toHaveValue('x');
	expect(errors).toEqual([]);
});

test('the reveal button renders as a suffix cap', async ({ page }) => {
	await page.goto('/instrumentation/types.html');
	await expect(page.locator('.fs-caps:has(#password) > button.fs-reveal')).toBeVisible();
});

test('a selected radio deselects on second click', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const first = page.locator('input[name="radio-list"]').first();
	await first.check();
	await expect(first).toBeChecked();
	await first.click();
	await expect(first).not.toBeChecked();
	await expect(page.locator('fieldset.toggle-list:has(input[name="radio-list"])')).toHaveClass(/fs-incomplete/);
});

test('clicking the only selected multi-select item deselects it', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const select = page.locator('#multi-select');
	await select.selectOption({ index: 0 });
	await expect(select).toHaveValues([/.+/]);
	await page.locator('#multi-select option').first().click();
	await expect(select).toHaveValues([]);
});

test('a mutual clear pair keeps the keystroke and clears only the partner', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await page.locator('#mutual-b').fill('stale');
	await page.locator('#mutual-a').pressSequentially('x');
	await expect(page.locator('#mutual-b')).toHaveValue('');
	await expect(page.locator('#mutual-a')).toHaveValue('x');
});

test('a no-match copy unchecks the radio mirror and the engine hears it', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await page.locator('#copy-plan').selectOption('Custom');
	await expect(page.locator('input[name="plan-mirror"][value="Basic"]')).not.toBeChecked();
	await expect(page.locator('#plan-mirror-set')).toHaveClass(/fs-incomplete/);
});

test('deselecting a copy-to source radio unchecks its mirror', async ({ page }) => {
	const small = page.locator('input[name="source-size"][value="Small"]');
	const mirror = page.locator('input[name="mirror-size"][value="Small"]');
	await small.check();
	await expect(mirror).toBeChecked();
	await small.click();
	await expect(small).not.toBeChecked();
	await expect(mirror).not.toBeChecked();
});

test('a select source checks its matching checkbox-mirror member', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await page.locator('#copy-interest').selectOption('Basic');
	await expect(page.locator('input[name="interests"][value="Basic"]')).toBeChecked();
});

test('a required radio group with an authored default keeps its answer on second click', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	const basic = page.locator('input[name="locked-tier"][value="basic"]');
	await expect(basic).toBeChecked();
	await basic.click();
	await expect(basic).toBeChecked();
});

test('a required multi-select with an authored default keeps its last selection', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	const select = page.locator('#locked-multi');
	await expect(select).toHaveValues(['Alpha']);
	await page.locator('#locked-multi option').first().click();
	await expect(select).toHaveValues(['Alpha']);
});

test('an optional radio group deselects even with an authored default', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	const red = page.locator('input[name="defaulted-color"][value="red"]');
	await expect(red).toBeChecked();
	await red.click();
	await expect(red).not.toBeChecked();
});

test('a unit price multiplies a numeric answer', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await page.locator('#qty').selectOption('3');
	await expect(page.locator('#priced-total')).toHaveText('30.00');
});

test('option-level amounts charge the selected option flat', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await page.locator('#metal').selectOption({ label: 'Silver — $10' });
	await expect(page.locator('#priced-total')).toHaveText('10.00');
});

test('priced choices charge flat and discounts subtract', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await page.locator('input[name="size"][value="Medium"]').check();
	await expect(page.locator('#priced-total')).toHaveText('10.00');
	await page.locator('input[name="perks"][value="Member"]').check();
	await expect(page.locator('#priced-total')).toHaveText('0.00');
});

test('a priced file charges when a file is chosen', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await page.locator('#artwork').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') });
	await expect(page.locator('#priced-total')).toHaveText('100.00');
});

test('copy-to checks the matching radio and mirrors checkbox state', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	await page.locator('input[name="source-size"][value="Medium"]').check();
	await expect(page.locator('input[name="mirror-size"][value="Medium"]')).toBeChecked();
	await page.locator('input[name="source-toppings"][value="Fudge"]').check();
	await expect(page.locator('input[name="mirror-toppings"][value="Fudge"]')).toBeChecked();
	await page.locator('input[name="source-toppings"][value="Fudge"]').uncheck();
	await expect(page.locator('input[name="mirror-toppings"][value="Fudge"]')).not.toBeChecked();
});

test('year options run backward as well as forward', async ({ page }) => {
	await page.goto('/instrumentation/operations.html');
	const first = page.locator('#grad-year option').nth(1);
	const year = new Date().getFullYear();
	await expect(first).toHaveText(String(year - 15));
});
