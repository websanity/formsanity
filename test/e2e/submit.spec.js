import { test, expect } from '@playwright/test';

async function complete(page) {
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
}

test('accepted submission shows the server message', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
});

test('rejection maps server errors onto fields', async ({ page }) => {
	await page.goto('/demos/submission.html?scenario=invalid');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
	// A rejected field is a wrong answer: the standing invalid line shows
	// and the gate closes until it is fixed.
	await expect(page.locator('.fs-status .fs-status-invalid')).toBeVisible();
	await expect(page.locator('.fs-status .fs-status-invalid')).toContainText('Please fix the highlighted fields');
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await page.locator('#email').fill('fresh@example.com');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

// Answers every submission with an invalid envelope carrying these errors.
async function rejectWith(page, errors) {
	await page.route('**/api/submit*', (route) => route.fulfill({
		status: 422,
		contentType: 'application/json',
		body: JSON.stringify({ formsanity: 2, status: 'invalid', errors })
	}));
}

const BOUNCED = { field: 'email-secondary', code: 'x-bounced', message: 'Mail to this address bounced.' };

async function completeComparisons(page) {
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').fill('hunter22');
	await page.locator('#email-primary').fill('jans@websanity.com');
	await page.locator('#email-secondary').fill('jans@example.com');
}

test('a rejected field keeps its error as focus leaves it, until the field is edited', async ({ page }) => {
	await page.goto('/demos/submission.html?scenario=invalid');
	await complete(page);
	const submit = page.locator('button[type="submit"]');
	const bubble = page.locator('li:has(#email) .fs-error');
	const invalidLine = page.locator('.fs-status .fs-status-invalid');
	await submit.click();
	await expect(bubble).toContainText('already in use');
	// The engine checks a field again as focus leaves it, and the server's verdict is one its own rules cannot re-derive.
	await page.locator('#email').focus();
	await page.locator('#note').focus();
	await expect(bubble).toContainText('already in use');
	await expect(invalidLine).toBeVisible();
	await expect(submit).toBeDisabled();
	await page.locator('#email').fill('fresh@example.com');
	await expect(bubble).toHaveCount(0);
	await expect(invalidLine).toBeHidden();
	await expect(submit).toBeEnabled();
});

test('a rejected field keeps its error when an edit of another field checks it again', async ({ page }) => {
	await rejectWith(page, [BOUNCED]);
	await page.goto('/demos/comparisons.html');
	await completeComparisons(page);
	const submit = page.locator('button[type="submit"]');
	const bubble = page.locator('li:has(#email-secondary) .fs-error');
	await submit.click();
	await expect(bubble).toHaveText(BOUNCED.message);
	// The secondary address's rule reads the primary, so each edit of the primary and its blur check the secondary again.
	await page.locator('#email-primary').fill('jdoe@websanity.com');
	await page.locator('#email-primary').blur();
	await expect(bubble).toHaveText(BOUNCED.message);
	await expect(submit).toBeDisabled();
	await page.locator('#email-secondary').fill('jdoe@example.com');
	await expect(bubble).toHaveCount(0);
	await expect(submit).toBeEnabled();
});

test('a refused submit repeats the server\'s message on a field it rejected', async ({ page }) => {
	const bounced = { field: 'address', code: 'x-bounced', message: 'Mail to this address bounced.' };
	await rejectWith(page, [bounced]);
	// Without the gate the button stays pressable, so the engine's own refusal presents the field's error again.
	await page.goto('/test/fixtures/no-gate.html');
	await page.locator('#address').fill('jans@example.com');
	const submit = page.locator('button[type="submit"]');
	const bubble = page.locator('li:has(#address) .fs-error');
	await submit.click();
	await expect(bubble).toHaveText(bounced.message);
	await submit.click();
	await expect(page.locator('#address')).toBeFocused();
	await expect(bubble).toHaveText(bounced.message);
});

test('a rejected field that becomes irrelevant drops its error, which stays gone when the field returns', async ({ page }) => {
	await rejectWith(page, [{ field: 'other-color', code: 'x-unstocked', message: 'We do not stock that color.' }]);
	await page.goto('/demos/relevance.html');
	await page.locator('#color').selectOption('Other');
	await page.locator('#other-color').fill('Teal');
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	await page.locator('input[name="journal"][value="Online"]').check();
	const submit = page.locator('button[type="submit"]');
	const bubble = page.locator('li:has(#other-color) .fs-error');
	await submit.click();
	await expect(bubble).toHaveText('We do not stock that color.');
	// Irrelevant, the field leaves the submission, and the value the server judged leaves with it.
	await page.locator('#color').selectOption('Red');
	await expect(submit).toBeEnabled();
	await page.locator('#color').selectOption('Other');
	await expect(page.locator('#other-color')).toHaveValue('Teal');
	await expect(bubble).toHaveCount(0);
	await expect(submit).toBeEnabled();
});

test('redirect follows', async ({ page }) => {
	await page.goto('/demos/submission.html?scenario=redirect');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/submitted\.html/);
});

test('pre-submit hook fields are merged', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body.token).toBe('tok_123');
	expect(body.csrf).toBe('demo-token');
});

test('unique check marks the field from the server', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.locator('#email').fill('taken@example.com');
	await page.locator('#email').blur();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});

test('irrelevant fields are omitted from the submission', async ({ page }) => {
	await page.goto('/demos/relevance.html');
	await page.locator('#account-password').fill('longenough1');
	await page.locator('#account-confirm').fill('longenough1');
	// The journal set is required (one member carries required), so an always-relevant member is chosen; the set is unrelated to what this test checks.
	await page.locator('input[name="journal"][value="Online"]').check();
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body).not.toHaveProperty('other-color');
});

test('rapid double-click submits only once', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await complete(page);
	let submitCount = 0;
	page.on('request', (request) => {
		if (request.url().includes('/api/submit')) submitCount += 1;
	});
	// Two synchronous DOM .click() calls in one page.evaluate — bypasses
	// Playwright's actionability auto-wait so both 'submit' events fire back
	// to back, before any async work from the first click has resolved.
	await page.evaluate(() => {
		const button = document.querySelector('button[type="submit"]');
		button.click();
		button.click();
	});
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
	expect(submitCount).toBe(1);
});

test('a multi-select submits every selected value as an array', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
	await page.locator('#colors').selectOption(['Red', 'Blue']);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	expect((await posted).postDataJSON().colors).toEqual(['Red', 'Blue']);
});

test('a multipart body names the parts of an array-valued field with the [] suffix', async ({ page }) => {
	await page.goto('/test/fixtures/multipart.html');
	await page.locator('#city').fill('Boston');
	await page.locator('input[name="colors"][value="Red"]').check();
	await page.locator('input[name="colors"][value="Blue"]').check();
	await page.locator('#sizes').selectOption(['S', 'L']);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	const request = await posted;
	expect(request.headers()['content-type']).toMatch(/^multipart\/form-data/);
	const body = request.postDataBuffer().toString('latin1');
	expect(body.match(/name="colors\[\]"/g)).toHaveLength(2);
	expect(body.match(/name="sizes\[\]"/g)).toHaveLength(2);
	expect(body.match(/name="city"/g)).toHaveLength(1);
	expect(body).not.toMatch(/name="colors"/);
	expect(body).not.toMatch(/name="attachment/);
});

test('file parts are named by the field: bare without multiple, [] with it, and a lone checkbox sends an array', async ({ page }) => {
	// A request that carries a real file exposes its body only inside a route handler, so the body is captured there and the request is let through.
	let body = null;
	await page.route('**/api/submit*', async (route) => {
		body = route.request().postDataBuffer().toString('latin1');
		await route.continue();
	});
	await page.goto('/test/fixtures/multipart.html');
	await page.locator('#gift').check();
	const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
	await page.locator('#photo').setInputFiles(pdf('photo.pdf'));
	await page.locator('#attachment').setInputFiles([pdf('a.pdf'), pdf('b.pdf')]);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	await posted;
	expect(body).not.toBeNull();
	expect(body.match(/name="photo"; filename="photo.pdf"/g)).toHaveLength(1);
	expect(body.match(/name="attachment\[\]"; filename=/g)).toHaveLength(2);
	expect(body.match(/name="gift\[\]"/g)).toHaveLength(1);
});
