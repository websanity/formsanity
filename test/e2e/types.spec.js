import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/types.html'); });

test('zip dead-end flags immediately', async ({ page }) => {
	await page.locator('#zip').pressSequentially('80a');
	await expect(page.locator('li:has(#zip)')).toHaveClass(/fs-invalid/);
});

test('zip incomplete waits for blur', async ({ page }) => {
	await page.locator('#zip').pressSequentially('802');
	await expect(page.locator('li:has(#zip) .fs-error')).toHaveCount(0);
	await page.locator('#zip').blur();
	await expect(page.locator('li:has(#zip) .fs-error')).toContainText('#####');
});

test('credit-card respects the network param', async ({ page }) => {
	await page.locator('#card').fill('378282246310005');
	await page.locator('#card').blur();
	await expect(page.locator('li:has(#card) .fs-error')).toContainText('Visa');
});

test('prefix and suffix caps render fused to their controls', async ({ page }) => {
	await expect(page.locator('.fs-caps:has(#us-dollar) > .fs-prefix')).toHaveText('$');
	await expect(page.locator('.fs-caps:has(#quantity) > .fs-suffix')).toHaveText('units');
});

test('a capped field still validates and keeps its plain value', async ({ page }) => {
	await page.locator('#us-dollar').pressSequentially('12x');
	await expect(page.locator('li:has(#us-dollar)')).toHaveClass(/fs-invalid/);
	await expect(page.locator('#us-dollar')).toHaveValue('12x');
});

test('file inputs get the accent choose-file cap', async ({ page }) => {
	const cap = page.locator('.fs-caps:has(#upload) > .fs-suffix');
	await expect(cap).toHaveText('Choose file…');
	const bg = await cap.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(bg).toBe('rgb(21, 107, 193)');
	const nativeButton = await page.locator('#upload').evaluate((el) => getComputedStyle(el, '::file-selector-button').display);
	expect(nativeButton).toBe('none');
});

test('the no-file placeholder text is annotation gray until a file is chosen', async ({ page }) => {
	const input = page.locator('#upload');
	await expect(input).toHaveCSS('color', 'rgb(102, 102, 102)');
	await input.setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
	await expect(page.locator('.fs-caps:has(#upload)')).toHaveClass(/fs-has-file/);
	await expect(input).not.toHaveCSS('color', 'rgb(102, 102, 102)');
});

test('date and time inputs get picker caps that open or focus the control', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (e) => errors.push(e));
	const dateCap = page.locator('.fs-caps:has(#start-date) > .fs-suffix.fs-picker-date');
	await expect(dateCap).toHaveAttribute('aria-hidden', 'true');
	const glyph = await dateCap.evaluate((el) => getComputedStyle(el, '::before').maskImage);
	expect(glyph).toContain('svg');
	const scheme = await dateCap.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
	expect(scheme).toEqual(['rgb(21, 107, 193)', 'rgb(255, 255, 255)']);
	await expect(page.locator('.fs-caps:has(#meeting-time) > .fs-suffix.fs-picker-time')).toBeVisible();
	await page.locator('.fs-caps:has(#meeting-time) > .fs-suffix').click();
	expect(errors).toEqual([]);
});

test('the native password row has an accent visibility toggle cap', async ({ page }) => {
	const cap = page.locator('.fs-caps:has(#password) > button.fs-reveal');
	await expect(cap).toHaveAttribute('aria-label', 'Show password');
	const bg = await cap.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(bg).toBe('rgb(21, 107, 193)');
	const glyph = await cap.evaluate((el) => getComputedStyle(el, '::before').maskImage);
	expect(glyph).toContain('svg');
	await cap.click();
	await expect(page.locator('#password')).toHaveAttribute('type', 'text');
	await expect(cap).toHaveAttribute('aria-label', 'Hide password');
});

test('format hints become placeholders when the author wrote none', async ({ page }) => {
	await expect(page.locator('#zip')).toHaveAttribute('placeholder', '##### or #####-####');
	await expect(page.locator('#us-dollar')).toHaveAttribute('placeholder', '###.##');
	await expect(page.locator('#cvv')).toHaveAttribute('placeholder', '###');
	await expect(page.locator('#duration')).toHaveAttribute('placeholder', 'HH:MM');
	await expect(page.locator('#email')).toHaveAttribute('placeholder', 'must be an email address');
});
