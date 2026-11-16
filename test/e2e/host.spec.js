import { test, expect } from '@playwright/test';

// The fixture loads a host stylesheet after the library: a reset that aims element selectors at form markup, and theme rules of one and two classes. Every library rule weighs three classes or more, so the library's declarations stand.

test.beforeEach(async ({ page }) => {
	await page.goto('/test/fixtures/host-css.html');
	await page.waitForSelector('form.fs-form');
});

const styleOf = (locator, properties, pseudo) => locator.evaluate((el, [names, which]) => {
	const style = getComputedStyle(el, which ?? undefined);
	return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
}, [properties, pseudo]);

test('a section keeps its box against the rules of the host', async ({ page }) => {
	const section = page.locator('#host-css > fieldset').first();
	expect(await styleOf(section, ['min-width', 'margin-top', 'margin-bottom', 'margin-left', 'padding-left', 'border-top-width', 'border-bottom-width', 'border-bottom-style'])).toEqual({
		'min-width': '0px',
		'margin-top': '24px',
		'margin-bottom': '24px',
		'margin-left': '0px',
		'padding-left': '16px',
		'border-top-width': '1px',
		'border-bottom-width': '1px',
		'border-bottom-style': 'solid'
	});
});

test('a legend stays on the border of its section', async ({ page }) => {
	const section = page.locator('#host-css > fieldset').first();
	const legend = section.locator('legend');
	expect(await styleOf(legend, ['float', 'margin-bottom', 'padding-left', 'font-size'])).toEqual({
		'float': 'none',
		'margin-bottom': '0px',
		'padding-left': '9px',
		'font-size': '18px'
	});
	// The color of a legend fades to the color of the section when the engine takes the form, so the test waits for the end of the fade.
	const text = await styleOf(section, ['color']);
	await expect(legend).toHaveCSS('color', text.color);
	// A legend the browser renders on the border is as wide as its text, and its top edge is the top edge of the section. A floated legend starts below the border.
	const box = await legend.boundingBox();
	const frame = await section.boundingBox();
	expect(box.width).toBeLessThan(frame.width / 2);
	expect(box.y).toBeCloseTo(frame.y, 0);
});

test('paragraphs and lists keep the margins and padding of the library', async ({ page }) => {
	const section = page.locator('#host-css > fieldset').first();
	expect(await styleOf(section.locator('p'), ['margin-top', 'margin-bottom'])).toEqual({ 'margin-top': '16px', 'margin-bottom': '16px' });
	expect(await styleOf(section.locator('ul'), ['padding-left', 'list-style-type'])).toEqual({ 'padding-left': '0px', 'list-style-type': 'none' });
});

test('every element and every drawn pseudo-element measures its box at the border', async ({ page }) => {
	const form = page.locator('#host-css');
	expect(await styleOf(form, ['box-sizing'])).toEqual({ 'box-sizing': 'border-box' });
	expect(await styleOf(form.locator('#name'), ['box-sizing'])).toEqual({ 'box-sizing': 'border-box' });
	// The indicator of a toggle is 1em square, border included, which centers it on the first line of the label.
	const toggle = form.locator('label:has(input[name="terms"])');
	expect(await styleOf(toggle, ['box-sizing', 'width', 'height'], '::before')).toEqual({ 'box-sizing': 'border-box', 'width': '16px', 'height': '16px' });
});

test('the submit button keeps its corners', async ({ page }) => {
	// The knob rule in the fixture sets the radius to zero, so the button reads the knob, and the border proves the library rule applies.
	expect(await styleOf(page.locator('#host-css > button'), ['border-top-width', 'display'])).toEqual({ 'border-top-width': '1px', 'display': 'block' });
});

test('a knob is set with one class, in a stylesheet that loads before the library', async ({ page }) => {
	expect(await styleOf(page.locator('#name'), ['border-top-left-radius'])).toEqual({ 'border-top-left-radius': '0px' });
});

test('a knob set on an element in the form applies from that element down', async ({ page }) => {
	const accent = (name) => styleOf(page.locator(`label:has(input[name="${name}"])`), ['border-top-color'], '::before');
	await page.locator('input[name="terms"]').check({ force: true });
	expect(await accent('news')).toEqual({ 'border-top-color': 'rgb(0, 128, 0)' });
	expect((await accent('terms'))['border-top-color']).not.toBe('rgb(0, 128, 0)');
});

test('a copy of a library rule, nesting included, loaded after the library, overrides one declaration', async ({ page }) => {
	expect(await styleOf(page.locator('#host-css legend').first(), ['font-weight'])).toEqual({ 'font-weight': '400' });
	// The indicator rule nests under a list of two selectors and takes the specificity of the heavier one, so a member of a radio group proves the copy has that specificity too.
	expect(await styleOf(page.locator('label:has(input[name="contact"])').first(), ['border-top-style'], '::before')).toEqual({ 'border-top-style': 'dashed' });
	expect(await styleOf(page.locator('label:has(input[name="terms"])'), ['border-top-style'], '::before')).toEqual({ 'border-top-style': 'dashed' });
});

test('the breakpoint recipe moves the left-label breakpoint when it loads after the library', async ({ page }) => {
	// The fieldset is the container. At 36rem it is past the shipped 32rem and short of the moved 40rem.
	const section = page.locator('#host-css > fieldset').first();
	const row = section.locator('li').first();
	const stacked = async () => {
		const label = await row.locator('label').boundingBox();
		const input = await row.locator('input').boundingBox();
		return label.y + label.height <= input.y;
	};
	await section.evaluate((el) => { el.style.width = '36rem'; });
	expect(await stacked()).toBe(false);
	await page.addStyleTag({ content: `
		@container fs-group (width < 40rem) {
			.fs-form.fs-form.fs-form fieldset:not(.fs-toggles) > ul {
				grid-template-columns: minmax(0, 1fr);
				--_fs-label-justify: stretch;
				--_fs-label-align: left;
				--_fs-label-pad: 0;
				--_fs-control-column: 1;
			}
		}
		@container fs-group (width >= 40rem) {
			.fs-form.fs-form.fs-form fieldset:not(.fs-toggles) > ul {
				grid-template-columns: var(--fs-label-width) minmax(0, 1fr);
				--_fs-label-justify: end;
				--_fs-label-align: right;
				--_fs-label-pad: var(--fs-control-padding);
				--_fs-control-column: 2;
			}
		}
	` });
	expect(await stacked()).toBe(true);
	await section.evaluate((el) => { el.style.width = '44rem'; });
	expect(await stacked()).toBe(false);
});
