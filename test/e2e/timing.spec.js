import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/instrumentation/index.html');
});

test('incomplete defers to blur, then clears live', async ({ page }) => {
	const email = page.locator('#email');
	await email.fill('jans@websanity');
	await expect(page.locator('#email ~ .fs-error, [id="email"] + .fs-error')).toHaveCount(0);
	await email.blur();
	const row = page.locator('li:has(#email)');
	await expect(row).toHaveClass(/fs-incomplete|fs-invalid/);
	await expect(row.locator('.fs-error')).toBeVisible();
	await email.fill('jans@websanity.com');
	await expect(row.locator('.fs-error')).toHaveCount(0);
	await expect(row).toHaveClass(/fs-valid/);
});

test('dead-end presents immediately on input', async ({ page }) => {
	const age = page.locator('#age');
	await age.pressSequentially('200');
	const row = page.locator('li:has(#age)');
	await expect(row).toHaveClass(/fs-invalid/);
	await expect(row.locator('.fs-error')).toContainText('maximum of 120');
});

test('required empty is incomplete (asterisk state), not an error bubble', async ({ page }) => {
	const row = page.locator('li:has(#full-name)');
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
});

test('error message is wired for assistive tech', async ({ page }) => {
	const email = page.locator('#email');
	await email.fill('nope@');
	await email.blur();
	await expect(email).toHaveAttribute('aria-invalid', 'true');
	// aria-describedby is a token list — the bubble id sits alongside any
	// author-supplied hint id rather than replacing it, so pull just the
	// bubble's own token out to find it.
	const bubble = page.locator('li:has(#email) .fs-error');
	const bubbleId = await bubble.getAttribute('id');
	const described = (await email.getAttribute('aria-describedby')).split(/\s+/);
	expect(described).toContain(bubbleId);
	await expect(bubble).toContainText('email');
});

test('a picker-committed out-of-range value presents without blur', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	// A native picker commits value + input + change without ever focusing
	// the control, so no blur follows.
	await page.locator('#business-hours').evaluate((el) => {
		el.value = '08:00';
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await expect(page.locator('li:has(#business-hours) .fs-error')).toContainText(/9:00\sAM/);
});
