import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/index.html'); });

// Fills every required field on the Required page. The required-together contact
// group stays empty on purpose — none is a valid state.
async function completeForm(page) {
	await page.locator('#full-name').fill('Jans Carton');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#age').fill('44');
	await page.locator('#password').fill('hunter2!');
	await page.locator('#attachment').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
	await page.locator('#flavor').selectOption({ index: 1 });
	await page.locator('#compound-month').selectOption({ index: 1 });
	await page.locator('#compound-year').selectOption({ index: 1 });
	await page.locator('#multi-select').selectOption({ index: 0 });
	await page.locator('#bio').fill('A short biography.');
	await page.locator('input[name="radio-list"]').first().check();
	await page.locator('input[name="checkbox-list"]').first().check();
	await page.locator('input[name="radio-buttons"]').first().check();
	await page.locator('input[name="checkbox-buttons"]').first().check();
	await page.locator('#club-seats').fill('2');
}

test('gate disables submit and shows the incomplete message', async ({ page }) => {
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await expect(page.locator('.fs-status-incomplete')).toBeVisible();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

test('invalid values show the invalid message separately', async ({ page }) => {
	await page.locator('#age').fill('200');
	await expect(page.locator('.fs-status-invalid')).toBeVisible();
});

test('completing the form releases the gate and clears messages', async ({ page }) => {
	await completeForm(page);
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
	await expect(page.locator('.fs-status-incomplete')).toBeHidden();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

// Regression: showBubble used to overwrite aria-describedby outright with
// its own bubble id, and clearBubble stripped the attribute entirely —
// either one destroyed an author's own hint association. The bubble id must
// only be added/removed as one token among any pre-existing ones.
test('error show/clear preserves an author-supplied aria-describedby hint', async ({ page }) => {
	const email = page.locator('#email');
	await expect(email).toHaveAttribute('aria-describedby', 'email-hint');
	await email.fill('not-an-email@@bad');
	await expect(email).toHaveAttribute('aria-describedby', /(^|\s)email-hint(\s|$)/);
	await expect(email).toHaveAttribute('aria-describedby', /fs-error-/);
	await email.fill('jans@websanity.com');
	await expect(email).toHaveAttribute('aria-describedby', 'email-hint');
});

test('when-valid element reacts', async ({ page }) => {
	await expect(page.locator('#ready-note')).toBeHidden();
	await completeForm(page);
	await expect(page.locator('#ready-note')).toBeVisible();
});
