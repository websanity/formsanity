import { test, expect } from '@playwright/test';

// The asterisk is painted rather than drawn: --fs-asterisk-color fills the
// pseudo-element's box and the SVG masks it. The mask carries the artwork the
// brief's backgroundImage assertion used to look for, and the background-color
// is what makes the knob live — both are checked here.
test('missing required answers show the asterisk; wrong answers get the bubble instead', async ({ page }) => {
	await page.goto('/demos/required.html');
	const label = page.locator('li.fs-missing label').first();
	const content = await label.evaluate((el) => getComputedStyle(el, '::after').maskImage);
	expect(content).toContain('svg');
	const email = page.locator('#email');
	await email.fill('a@@b');
	const row = page.locator('li:has(#email)');
	await expect(row).toHaveClass(/fs-invalid/);
	await expect(row).not.toHaveClass(/fs-missing/);
	await expect(row.locator('.fs-error')).toBeVisible();
	const unpainted = await row.locator('label').evaluate((el) => getComputedStyle(el, '::after').backgroundColor);
	expect(unpainted).toBe('rgba(0, 0, 0, 0)');
});

test('the asterisk takes its color from the knob', async ({ page }) => {
	await page.goto('/demos/required.html');
	const label = page.locator('li.fs-missing label').first();
	const painted = await label.evaluate((el) => {
		el.closest('form').style.setProperty('--fs-asterisk-color', 'rgb(0, 128, 0)');
		return getComputedStyle(el, '::after').backgroundColor;
	});
	expect(painted).toBe('rgb(0, 128, 0)');
});

test('error bubble is styled as a bubble', async ({ page }) => {
	await page.goto('/demos/required.html');
	await page.locator('#email').fill('a@@b');
	const bubble = page.locator('li:has(#email) .fs-error');
	await expect(bubble).toBeVisible();
	const radius = await bubble.evaluate((el) => getComputedStyle(el).borderRadius);
	expect(radius).not.toBe('0px');
});

// Regression: an unchecked toggle indicator used to borrow --fs-border-color
// (hsl(0 0% 70%), ~2.1:1 against white), short of the 3:1 WCAG 1.4.11 needs
// for a UI component boundary. It now has its own private, darker default.
test('an unchecked toggle indicator uses the darker toggle-border color', async ({ page }) => {
	await page.goto('/demos/required.html');
	const indicator = page.locator('.fs-toggles:not(.fs-buttons) li label').first();
	const borderColor = await indicator.evaluate((el) => getComputedStyle(el, '::before').borderColor);
	expect(borderColor).toBe('rgb(143, 143, 143)');
});

test('toggle buttons render as buttons', async ({ page }) => {
	await page.goto('/demos/required.html');
	const label = page.locator('.fs-toggles.fs-buttons li label').first();
	const display = await label.evaluate((el) => getComputedStyle(el).display);
	expect(display).not.toBe('inline');
});

// Regression: a covered toggle input is hidden structurally, not by state — it
// is the hit target laid over its own label, and the drawn indicator stands in
// for it. Letting that opacity ride the state transition meant every toggle
test('a compound row hosts its bubble after the wrapper, not inside it', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await page.locator('#pair-first').fill('not-an-email');
	await page.locator('#pair-first').blur();
	await expect(page.locator('li:has(#pair-first) > .fs-error')).toBeVisible();
	await expect(page.locator('.fs-compound .fs-error')).toHaveCount(0);
});

test('a wrapping label hosts its bubble outside itself', async ({ page }) => {
	await page.goto('/test/fixtures/edge-cases.html');
	await page.locator('#agree-check').check();
	await expect(page.locator('li:has(#agree-check) > .fs-error')).toBeVisible();
	await expect(page.locator('label .fs-error')).toHaveCount(0);
});

// faded from a full native radio or checkbox down to invisible over 150ms the
// moment init added .fs-form, so a page load flashed native controls sitting on
// top of their own labels. Re-adding the class reproduces exactly that moment.
test('a covered toggle input hides instantly rather than fading in from native', async ({ page }) => {
	await page.goto('/demos/required.html');
	const opacity = await page.locator('input[name="checkbox-list"]').first().evaluate((input) => {
		const form = input.closest('form');
		form.classList.remove('fs-form');
		getComputedStyle(input).opacity;
		form.classList.add('fs-form');
		return getComputedStyle(input).opacity;
	});
	expect(opacity).toBe('0');
});

// A forced palette repaints author colors, so a toggle that says "checked" in
// an author color alone reads as unchecked. Both tests ask what the indicator
// actually resolves to and compare it against a probe painted in the palette's
// own words — the author accent surviving there is the defect.
//
// The context is built by hand: test.use({ forcedColors }) does not reach the
// page in this runner setup, and a spec that emulates nothing would pass no
// matter what the stylesheet says.
test.describe('forced colors', () => {
	const forcedPage = async (browser, url) => {
		const context = await browser.newContext({ forcedColors: 'active' });
		const page = await context.newPage();
		await page.goto(url);
		return page;
	};

	const systemColor = (page, keyword) => page.evaluate((color) => {
		const probe = document.createElement('span');
		probe.style.color = color;
		document.body.append(probe);
		const painted = getComputedStyle(probe).color;
		probe.remove();
		return painted;
	}, keyword);

	test('a checked toggle paints its box in the forced palette', async ({ browser, baseURL }) => {
		const page = await forcedPage(browser, `${baseURL}/demos/required.html`);
		const box = page.locator('input[name="checkbox-list"]').first();
		await box.check();
		await box.blur();
		// The state change is a 150ms transition, and a computed value read
		// mid-flight is an interpolation frame rather than the resting color.
		await page.waitForTimeout(300);
		const label = page.locator('.fs-toggles:has(input[name="checkbox-list"]) li label').first();
		const fill = await label.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
		expect(fill).toBe(await systemColor(page, 'CanvasText'));
		await page.context().close();
	});

	test('a checked toggle button paints itself in the forced palette', async ({ browser, baseURL }) => {
		const page = await forcedPage(browser, `${baseURL}/demos/required.html`);
		const radio = page.locator('input[name="radio-buttons"]').nth(1);
		await radio.check();
		await radio.blur();
		await page.waitForTimeout(300);
		const label = page.locator('.fs-toggles.fs-buttons li label').nth(1);
		const fill = await label.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(fill).toBe(await systemColor(page, 'Highlight'));
		await page.context().close();
	});
});

test('radio buttons render as a segmented control, checkbox buttons stay separated', async ({ page }) => {
	await page.goto('/demos/required.html');
	const radios = page.locator('fieldset.fs-toggles.fs-buttons:has(input[name="radio-buttons"])');
	await expect(radios).toHaveClass(/fs-segmented/);
	const labels = radios.locator('label');
	const middle = await labels.nth(1).evaluate((el) => {
		const cs = getComputedStyle(el);
		return { startBorder: cs.borderInlineStartWidth, radius: cs.borderRadius };
	});
	expect(middle).toEqual({ startBorder: '0px', radius: '0px' });
	const gap = await radios.locator('ul').evaluate((el) => getComputedStyle(el).columnGap);
	expect(gap).toBe('0px');
	await expect(page.locator('fieldset.fs-toggles.fs-buttons:has(input[name="checkbox-buttons"])')).not.toHaveClass(/fs-segmented/);
});

test('a segmented group that cannot fit becomes separated pills', async ({ page }) => {
	await page.goto('/demos/required.html');
	const radios = page.locator('fieldset.fs-toggles.fs-buttons:has(input[name="radio-buttons"])');
	await radios.evaluate((el) => { el.style.width = '120px'; });
	await expect(radios).toHaveClass(/fs-wrapped/);
	const radius = await radios.locator('label').nth(1).evaluate((el) => getComputedStyle(el).borderRadius);
	expect(parseFloat(radius)).toBeGreaterThan(20);
	await radios.evaluate((el) => { el.style.width = ''; });
	await expect(radios).not.toHaveClass(/fs-wrapped/);
});

test('dropdown selects draw the caret indicator; list selects do not', async ({ page }) => {
	await page.goto('/demos/required.html');
	const dropdown = await page.locator('#flavor').evaluate((el) => {
		const cs = getComputedStyle(el);
		return { appearance: cs.appearance, image: cs.backgroundImage };
	});
	expect(dropdown.appearance).toBe('none');
	expect(dropdown.image).toContain('svg');
	const list = await page.locator('#multi-select').evaluate((el) => getComputedStyle(el).backgroundImage);
	expect(list).toBe('none');
});

test('section legends reserve no marker slot; choice-group legends do', async ({ page }) => {
	await page.goto('/demos/required.html');
	const section = await page.locator('form > fieldset > legend').first().evaluate((el) => getComputedStyle(el, '::after').content);
	expect(section).toBe('none');
	const choice = await page.locator('fieldset.fs-toggles > legend').first().evaluate((el) => getComputedStyle(el, '::after').maskImage);
	expect(choice).toContain('svg');
});

test('a submit attempt never bubbles requiredness — asterisks and status carry it', async ({ page }) => {
	await page.goto('/demos/required.html');
	await page.locator('form.fs-form').evaluate((form) => form.requestSubmit());
	await expect(page.locator('.fs-status .fs-status-incomplete')).toBeVisible();
	await expect(page.locator('li:has(#full-name) .fs-error')).toHaveCount(0);
	await expect(page.locator('li:has(#full-name)')).toHaveClass(/fs-missing/);
});

test('the error bubble sits immediately below its control, above any hint', async ({ page }) => {
	await page.goto('/demos/required.html');
	await page.locator('#email').pressSequentially('not-an-email@');
	await page.locator('#email').blur();
	const nextIsBubble = await page.locator('#email').evaluate((el) => el.nextElementSibling?.classList.contains('fs-error'));
	expect(nextIsBubble).toBe(true);
});
