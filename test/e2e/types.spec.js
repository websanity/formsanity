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

test('a picker cap demotes to informational where the browser has no picker', async ({ page }) => {
	await page.addInitScript(() => {
		HTMLInputElement.prototype.showPicker = function () {
			throw new DOMException('no picker for this type', 'NotSupportedError');
		};
	});
	await page.goto('/instrumentation/types.html');
	const cap = page.locator('.fs-caps:has(#meeting-time) > .fs-suffix.fs-picker-time');
	await expect(cap).toHaveClass(/fs-inert/);
	const scheme = await cap.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).cursor]);
	expect(scheme[0]).not.toBe('rgb(21, 107, 193)');
	expect(scheme[1]).toBe('default');
});

test('a picker cap that fails its first press focuses the control and demotes', async ({ page }) => {
	await page.addInitScript(() => {
		const probed = new WeakSet();
		HTMLInputElement.prototype.showPicker = function () {
			if (!probed.has(this)) {
				probed.add(this);
				throw new DOMException('user activation is required', 'NotAllowedError');
			}
			throw new DOMException('no picker for this type', 'NotSupportedError');
		};
	});
	await page.goto('/instrumentation/types.html');
	const cap = page.locator('.fs-caps:has(#meeting-time) > .fs-suffix.fs-picker-time');
	await expect(cap).not.toHaveClass(/fs-inert/);
	await cap.click();
	await expect(cap).toHaveClass(/fs-inert/);
	await expect(page.locator('#meeting-time')).toBeFocused();
});

test('a picker cap keeps its accent where the picker exists', async ({ page }) => {
	await expect(page.locator('.fs-caps:has(#meeting-time) > .fs-suffix.fs-picker-time')).not.toHaveClass(/fs-inert/);
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

test('interactive cap glyphs are enlarged without changing field height', async ({ page }) => {
	const glyphWidth = await page.locator('.fs-caps:has(#start-date) > .fs-suffix').evaluate((el) => getComputedStyle(el, '::before').width);
	expect(parseFloat(glyphWidth)).toBeCloseTo(22.4, 0);
	const capped = await page.locator('.fs-caps:has(#us-dollar)').boundingBox();
	const plain = await page.locator('#zip').boundingBox();
	expect(Math.abs(capped.height - plain.height)).toBeLessThan(1);
	const revealed = await page.locator('.fs-caps:has(#password)').boundingBox();
	expect(Math.abs(revealed.height - plain.height)).toBeLessThan(1);
});

test('the color input matches the text-field height', async ({ page }) => {
	const color = await page.locator('#accent').boundingBox();
	const text = await page.locator('#email-native').boundingBox();
	expect(Math.abs(color.height - text.height)).toBeLessThan(1);
});

test('datetime-local gets a calendar picker cap', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (e) => errors.push(e));
	const cap = page.locator('.fs-caps:has(#appointment) > .fs-suffix.fs-picker-datetime-local');
	await expect(cap).toHaveAttribute('aria-hidden', 'true');
	const glyph = await cap.evaluate((el) => getComputedStyle(el, '::before').maskImage);
	expect(glyph).toContain('svg');
	await cap.click();
	expect(errors).toEqual([]);
});

test('duration offers datalist suggestions and still validates typed input', async ({ page }) => {
	await expect(page.locator('#duration')).toHaveAttribute('list', 'duration-suggestions');
	const options = await page.locator('#duration-suggestions option').count();
	expect(options).toBeGreaterThan(3);
	await page.locator('#duration').pressSequentially('1:75');
	await expect(page.locator('li:has(#duration)')).toHaveClass(/fs-invalid/);
});

test('a datalist-backed input gets a suggestions picker cap', async ({ page }) => {
	const errors = [];
	page.on('pageerror', (e) => errors.push(e));
	const cap = page.locator('.fs-caps:has(#duration) > .fs-suffix.fs-picker-list');
	await expect(cap).toHaveAttribute('aria-hidden', 'true');
	const glyph = await cap.evaluate((el) => getComputedStyle(el, '::before').maskImage);
	expect(glyph).toContain('svg');
	await cap.click();
	expect(errors).toEqual([]);
});

test.describe('canonicalization on commit', () => {
	const cases = [
		['#us-phone', '303.555.1234', '(303) 555-1234'],
		['#us-phone', '1 303 555 1234', '(303) 555-1234'],
		['#international-phone', '44 20 7946 0958', '+442079460958'],
		['#ssn', '123456789', '123-45-6789'],
		['#zip', '802101234', '80210-1234'],
		['#us-dollar', '$1,234.5', '1234.50'],
		['#duration', '90', '1:30'],
		['#duration', '2:3', '2:03']
	];
	for (const [selector, typed, canonical] of cases) {
		test(`${selector.slice(1)}: "${typed}" commits as "${canonical}"`, async ({ page }) => {
			await page.locator(selector).pressSequentially(typed);
			await page.locator(selector).blur();
			await expect(page.locator(selector)).toHaveValue(canonical);
			await expect(page.locator(`li:has(${selector})`)).toHaveClass(/fs-valid/);
		});
	}

	test('a not-valid value is left exactly as typed', async ({ page }) => {
		await page.locator('#ssn').pressSequentially('123-456');
		await page.locator('#ssn').blur();
		await expect(page.locator('#ssn')).toHaveValue('123-456');
	});

	test('Enter commits and canonicalizes without blur', async ({ page }) => {
		await page.locator('#zip').pressSequentially('802101234');
		await page.locator('#zip').press('Enter');
		await expect(page.locator('#zip')).toHaveValue('80210-1234');
	});
});
