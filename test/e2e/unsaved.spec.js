import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/demos/operations.html'); });

// Asks the page what it would answer to a departure, without one: a cancelable beforeunload that a listener cancels is a request to confirm. A real departure shows the browser's own dialog, which differs by engine.
const warns = (page) => page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })));

const form = (page) => page.locator('#operations-unsaved');

test('a form the person has not edited does not warn, though the engine wrote its total at load', async ({ page }) => {
	await expect(form(page).locator('#draft-cost')).toHaveText('0.30');
	expect(await warns(page)).toBe(false);
});

test('an edit makes the page warn before it is left', async ({ page }) => {
	await form(page).locator('#draft-title').pressSequentially('Q3');
	expect(await warns(page)).toBe(true);
});

test('an answer typed and then removed still counts as an edit', async ({ page }) => {
	await form(page).locator('#draft-title').pressSequentially('Q');
	await page.keyboard.press('Backspace');
	await expect(form(page).locator('#draft-title')).toHaveValue('');
	expect(await warns(page)).toBe(true);
});

test('a value that a script writes is not the person\'s edit', async ({ page }) => {
	await form(page).locator('#draft-title').evaluate((el) => {
		el.value = 'Prefilled';
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	});
	expect(await warns(page)).toBe(false);
});

test('a deselection is the person\'s edit', async ({ page }) => {
	const memo = form(page).locator('input[name="draft-kind"][value="Memo"]');
	await memo.click();
	await expect(memo).not.toBeChecked();
	expect(await warns(page)).toBe(true);
});

test('a form without the attribute never warns', async ({ page }) => {
	await page.locator('#billing-name').pressSequentially('hello');
	expect(await warns(page)).toBe(false);
});

test('an accepted submission ends the warning, and a later edit starts it again', async ({ page }) => {
	await form(page).locator('#draft-title').pressSequentially('Q3');
	await form(page).locator('button[type="submit"]').click();
	await expect(form(page).locator('.fs-status.fs-success')).toBeVisible();
	expect(await warns(page)).toBe(false);

	await form(page).locator('#draft-title').pressSequentially(' plan');
	expect(await warns(page)).toBe(true);
});

test('a rejected submission keeps the warning', async ({ page }) => {
	await form(page).evaluate((el) => { el.action = '/api/submit?scenario=invalid'; });
	await form(page).locator('#draft-title').pressSequentially('Q3');
	await form(page).locator('button[type="submit"]').click();
	await expect(form(page).locator('.fs-status .fs-status-error')).toBeVisible();
	expect(await warns(page)).toBe(true);
});

test('a redirect after an accepted submission is not held', async ({ page }) => {
	const dialogs = [];
	page.on('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.accept(); });
	await form(page).evaluate((el) => {
		el.action = '/api/submit?scenario=redirect';
		// Runs after the engine's own listener on the form, and before the client follows the redirect.
		document.addEventListener('fs:accepted', () => {
			window.sessionStorage.setItem('warned', String(!window.dispatchEvent(new Event('beforeunload', { cancelable: true }))));
		});
	});
	await form(page).locator('#draft-title').pressSequentially('Q3');
	expect(await warns(page)).toBe(true);
	await form(page).locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/submitted\.html/);
	expect(await page.evaluate(() => window.sessionStorage.getItem('warned'))).toBe('false');
	expect(dialogs).toEqual([]);
});

test('a form reset ends the warning, and a canceled reset keeps it', async ({ page }) => {
	await form(page).locator('#draft-title').pressSequentially('Q3');
	await form(page).evaluate((el) => el.addEventListener('reset', (event) => event.preventDefault(), { once: true }));
	await form(page).locator('button[type="reset"]').click();
	await expect(form(page).locator('#draft-title')).toHaveValue('Q3');
	expect(await warns(page)).toBe(true);

	await form(page).locator('button[type="reset"]').click();
	await expect(form(page).locator('#draft-title')).toHaveValue('');
	// The engine reads a reset one task after the event, when the browser has restored the answers.
	await expect.poll(() => warns(page)).toBe(false);
});

test('one unsaved form is enough, and the page stops listening when none is left', async ({ page }) => {
	await form(page).locator('#draft-title').pressSequentially('Q3');
	await form(page).evaluate((el) => el.remove());
	expect(await warns(page)).toBe(false);
});
