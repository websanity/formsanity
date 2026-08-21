import { test, expect } from '@playwright/test';

// Integration coverage for the four ported v1 mock forms in forms/. These are
// production-scale fixtures: whole real forms rather than one feature apiece,
// so they catch interactions between relevance, groups, amounts, generated
// options, compound rows, files, and the submit gate that the per-feature
// instrumentation pages can't.

// Collects everything the page reports as broken: uncaught exceptions
// (pageerror) and console.error output alike. A ported form that trips the
// engine at init shows up here before any assertion about behavior does.
function collectPageErrors(page) {
	const errors = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	return errors;
}

const gate = (page) => page.locator('button[type="submit"]');

async function fillCard(page) {
	await page.locator('#card_number').fill('4111111111111111');
	await page.locator('#card_exp_month').selectOption({ index: 1 });
	await page.locator('#card_exp_year').selectOption({ index: 1 });
	await page.locator('#card_cvv').fill('123');
}

async function fillPfemsAddress(page) {
	await page.locator('#address_street').fill('1701 Bryant St');
	await page.locator('#address_city').fill('Denver');
	await page.locator('#address_state').selectOption('CO');
	await page.locator('#address_zip').fill('80204');
}

async function fillPfemsContact(page) {
	await page.locator('#name_first').fill('Jordan');
	await page.locator('#name_last').fill('Doe');
	await page.locator('#team').selectOption('Denver Broncos');
	await page.locator('#job_title').fill('Equipment Manager');
	await page.locator('#phone_num').fill('303-555-0142');
	await page.locator('#phone_type').selectOption('mobile');
}

test.describe('pfems-join', () => {
	test('loads with no console errors', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/forms/pfems-join.html');
		await expect(page.locator('form.fs-form')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('gate starts disabled and the minimal valid path enables it', async ({ page }) => {
		await page.goto('/forms/pfems-join.html');
		await expect(gate(page)).toBeDisabled();
		await page.locator('#password').fill('Fremont2026pass');
		await fillPfemsContact(page);
		await fillPfemsAddress(page);
		await fillCard(page);
		await expect(gate(page)).toBeEnabled();
	});

	test('membership type toggles the payment section', async ({ page }) => {
		await page.goto('/forms/pfems-join.html');
		await expect(page.locator('#payment')).toBeVisible();
		await expect(page.locator('#card_number')).toBeEnabled();

		await page.locator('input[name="member_type"][value="Unpaid"]').check();
		await expect(page.locator('#payment')).toBeHidden();
		await expect(page.locator('#card_number')).toBeDisabled();

		await page.locator('input[name="member_type"][value="Standard"]').check();
		await expect(page.locator('#payment')).toBeVisible();
		await expect(page.locator('#card_number')).toBeEnabled();
	});

	test('an unpaid membership needs no card and omits the payment fields', async ({ page }) => {
		await page.goto('/forms/pfems-join.html');
		await page.locator('input[name="member_type"][value="Unpaid"]').check();
		await page.locator('#password').fill('Fremont2026pass');
		await fillPfemsContact(page);
		await fillPfemsAddress(page);
		await expect(gate(page)).toBeEnabled();

		const posted = page.waitForRequest('**/api/submit*');
		await gate(page).click();
		const body = (await posted).postDataJSON();
		expect(body.member_type).toEqual(['Unpaid']);
		expect(body).not.toHaveProperty('card_number');
		expect(body).not.toHaveProperty('amount_total');
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});

	test('a paid membership submits the card fields, the total, and the hook token', async ({ page }) => {
		await page.goto('/forms/pfems-join.html');
		await page.locator('#password').fill('Fremont2026pass');
		await fillPfemsContact(page);
		await fillPfemsAddress(page);
		await fillCard(page);

		const posted = page.waitForRequest('**/api/submit*');
		await gate(page).click();
		const body = (await posted).postDataJSON();
		expect(body.card_number).toBe('4111111111111111');
		expect(body.amount_total).toBe('80.00');
		expect(body.token).toBe('tok_demo_pfems_join');
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});
});

test.describe('pfems-profile', () => {
	test('loads with no console errors', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/forms/pfems-profile.html');
		await expect(page.locator('form.fs-form')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('gate starts disabled, the minimal valid path enables it, and the server accepts', async ({ page }) => {
		await page.goto('/forms/pfems-profile.html');
		await expect(gate(page)).toBeDisabled();
		await fillPfemsContact(page);
		await fillPfemsAddress(page);
		await expect(gate(page)).toBeEnabled();
		await gate(page).click();
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});

	test('the optional password field carries the reveal toggle and a maxlength counter rides the bio', async ({ page }) => {
		await page.goto('/forms/pfems-profile.html');
		await expect(page.locator('li:has(#password) button.fs-reveal')).toBeVisible();
		await expect(page.locator('.block:has(#biography) small.fs-counter')).toContainText('500 characters remaining');
	});
});

test.describe('meteoritical-donate', () => {
	test('loads with no console errors', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/forms/meteoritical-donate.html');
		await expect(page.locator('form.fs-form')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('gate starts disabled, the minimal valid path enables it, and the server accepts', async ({ page }) => {
		await page.goto('/forms/meteoritical-donate.html');
		await expect(gate(page)).toBeDisabled();
		await page.locator('#nier_fund').fill('25');
		await page.locator('input[name="acknowledgement"][value="Yes"]').check();
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#email').fill('jordan.doe@example.org');
		await fillCard(page);
		await expect(gate(page)).toBeEnabled();
		await gate(page).click();
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});

	test('the at-least-one group holds the gate until some fund is given', async ({ page }) => {
		await page.goto('/forms/meteoritical-donate.html');
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#email').fill('jordan.doe@example.org');
		await fillCard(page);
		await expect(gate(page)).toBeDisabled();
		await page.locator('#travel_fund').fill('40');
		await page.locator('input[name="acknowledgement"][value="No"]').check();
		await expect(gate(page)).toBeEnabled();
	});

	test('amounts total across the funds and post as the submitted total', async ({ page }) => {
		await page.goto('/forms/meteoritical-donate.html');
		await page.locator('#nier_fund').fill('25');
		await page.locator('#travel_fund').fill('40.50');
		await expect(page.locator('#amount_total')).toHaveValue('65.50');
		await page.locator('input[name="acknowledgement"][value="Yes"]').check();
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#email').fill('jordan.doe@example.org');
		await fillCard(page);

		const posted = page.waitForRequest('**/api/submit*');
		await gate(page).click();
		const body = (await posted).postDataJSON();
		expect(body.amount_total).toBe('65.50');
		expect(body.token).toBe('tok_demo_meteoritical');
	});

	test('the tribute answer reveals its own rows', async ({ page }) => {
		await page.goto('/forms/meteoritical-donate.html');
		await expect(page.locator('#tribute_type')).toBeDisabled();
		await page.locator('input[name="tribute"][value="yes"]').check();
		await expect(page.locator('#tribute_type')).toBeEnabled();
		await expect(page.locator('#tribute_name')).toBeEnabled();
		await expect(page.locator('#tribute_message')).toBeEnabled();
	});
});

test.describe('pfems-aux-personnel', () => {
	const smallFile = { name: 'headshot.png', mimeType: 'image/png', buffer: Buffer.alloc(64 * 1024) };
	const oversizeFile = { name: 'headshot.png', mimeType: 'image/png', buffer: Buffer.alloc(3 * 1024 * 1024) };

	test('loads with no console errors', async ({ page }) => {
		const errors = collectPageErrors(page);
		await page.goto('/forms/pfems-aux-personnel.html');
		await expect(page.locator('form.fs-form')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('gate starts disabled, the minimal valid path enables it, and the server accepts', async ({ page }) => {
		await page.goto('/forms/pfems-aux-personnel.html');
		await expect(gate(page)).toBeDisabled();
		await page.locator('input[name="facility_roles"][value="Trucking Contact"]').check();
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#phone_num').fill('303-555-0142');
		await page.locator('#phone_type').selectOption('mobile');
		await page.locator('#company').fill('Front Range Freight');
		await expect(gate(page)).toBeEnabled();
		await gate(page).click();
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});

	test('the clubhouse role swaps the contact rows for the photo row', async ({ page }) => {
		await page.goto('/forms/pfems-aux-personnel.html');
		await expect(page.locator('#photo')).toBeDisabled();
		await page.locator('input[name="facility_roles"][value="Visiting Clubhouse Manager"]').check();
		await expect(page.locator('#photo')).toBeEnabled();
		await expect(page.locator('#email')).toBeDisabled();
		await expect(page.locator('#phone_num')).toBeDisabled();
	});

	test('a small photo passes and posts', async ({ page }) => {
		await page.goto('/forms/pfems-aux-personnel.html');
		await page.locator('input[name="facility_roles"][value="Visiting Clubhouse Manager"]').check();
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#photo').setInputFiles(smallFile);
		await expect(page.locator('li:has(#photo)')).toHaveClass(/fs-valid/);
		await expect(gate(page)).toBeEnabled();

		// A form holding a file control posts multipart. Playwright exposes no
		// body for a request carrying a file part, so the assertion is that the
		// request goes out and the dev server parses it and accepts.
		const posted = page.waitForRequest('**/api/submit*');
		await gate(page).click();
		expect((await posted).method()).toBe('POST');
		await expect(page.locator('.fs-status')).toContainText('Thanks!');
	});

	test('a photo over the 2MB cap flags the row invalid and holds the gate', async ({ page }) => {
		await page.goto('/forms/pfems-aux-personnel.html');
		await page.locator('input[name="facility_roles"][value="Visiting Clubhouse Manager"]').check();
		await page.locator('#name_first').fill('Jordan');
		await page.locator('#name_last').fill('Doe');
		await page.locator('#photo').setInputFiles(oversizeFile);
		await expect(page.locator('li:has(#photo)')).toHaveClass(/fs-invalid/);
		await expect(page.locator('li:has(#photo) .fs-error')).toContainText('2MB');
		await expect(gate(page)).toBeDisabled();
	});
});
