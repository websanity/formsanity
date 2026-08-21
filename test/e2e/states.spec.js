import { test, expect } from '@playwright/test';

// The asterisk is painted rather than drawn: --fs-asterisk-color fills the
// pseudo-element's box and the SVG masks it. The mask carries the artwork the
// brief's backgroundImage assertion used to look for, and the background-color
// is what makes the knob live — both are checked here.
test('not-valid rows show the label asterisk', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const label = page.locator('li.fs-incomplete label').first();
	const content = await label.evaluate((el) => getComputedStyle(el, '::after').maskImage);
	expect(content).toContain('svg');
});

test('the asterisk takes its color from the knob', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const label = page.locator('li.fs-incomplete label').first();
	const painted = await label.evaluate((el) => {
		el.closest('form').style.setProperty('--fs-asterisk-color', 'rgb(0, 128, 0)');
		return getComputedStyle(el, '::after').backgroundColor;
	});
	expect(painted).toBe('rgb(0, 128, 0)');
});

test('error bubble is styled as a bubble', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	await page.locator('#email').fill('a@@b');
	const bubble = page.locator('li:has(#email) .fs-error');
	await expect(bubble).toBeVisible();
	const radius = await bubble.evaluate((el) => getComputedStyle(el).borderRadius);
	expect(radius).not.toBe('0px');
});

test('toggle buttons render as buttons', async ({ page }) => {
	await page.goto('/instrumentation/choice-groups.html');
	const label = page.locator('.toggle-list.buttons li label').first();
	const display = await label.evaluate((el) => getComputedStyle(el).display);
	expect(display).not.toBe('inline');
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
		const page = await forcedPage(browser, `${baseURL}/instrumentation/choice-groups.html`);
		const box = page.locator('input[name="toppings"]').first();
		await box.check();
		await box.blur();
		// The state change is a 150ms transition, and a computed value read
		// mid-flight is an interpolation frame rather than the resting color.
		await page.waitForTimeout(300);
		const label = page.locator('.toggle-list:not(.buttons) li label').first();
		const fill = await label.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
		expect(fill).toBe(await systemColor(page, 'CanvasText'));
		await page.context().close();
	});

	test('a checked toggle button paints itself in the forced palette', async ({ browser, baseURL }) => {
		const page = await forcedPage(browser, `${baseURL}/instrumentation/choice-groups.html`);
		const radio = page.locator('input[name="size"]').nth(1);
		await radio.check();
		await radio.blur();
		await page.waitForTimeout(300);
		const label = page.locator('.toggle-list.buttons li label').nth(1);
		const fill = await label.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(fill).toBe(await systemColor(page, 'Highlight'));
		await page.context().close();
	});
});
