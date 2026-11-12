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

test('a submit handler answers in place of the request', async ({ page }) => {
	await page.goto('/demos/submission.html?handler');
	await complete(page);
	let submitCount = 0;
	page.on('request', (request) => {
		if (request.url().includes('/api/submit')) submitCount += 1;
	});
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status.fs-success')).toContainText('Handled in the page for jans@websanity.com');
	expect(submitCount).toBe(0);
});

test('a submit handler\'s invalid envelope lands on its fields', async ({ page }) => {
	await page.goto('/demos/submission.html?handler');
	await page.locator('#note').fill('hello');
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('example.com is reserved');
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await page.locator('#email').fill('fresh@websanity.com');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
});

test('a submit handler receives the gathered payload with hook-injected keys, and its form-level errors reach the status region', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		setSubmitHandler(document.querySelector('form'), async ({ payload }) => {
			window.handled = payload;
			return { formsanity: 2, status: 'invalid', errors: [{ field: null, code: 'x-expired', message: 'The session expired' }] };
		});
	});
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status .fs-status-error')).toHaveText('The session expired');
	const payload = await page.evaluate(() => window.handled);
	expect(payload).toMatchObject({ email: 'jans@websanity.com', note: 'hello', csrf: 'demo-token', token: 'tok_123', colors: ['Red', 'Blue'] });
});

test('a submit handler that throws, or returns no envelope, reads as a failed request', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		const form = document.querySelector('form');
		form.addEventListener('fs:error', (event) => { window.errored = (window.errored ?? 0) + 1; window.envelope = event.detail.envelope; });
		setSubmitHandler(form, async () => { throw new Error('offline'); });
	});
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status.fs-error')).toContainText('Unexpected response from the server.');
	expect(await page.evaluate(() => [window.errored, window.envelope])).toEqual([1, null]);

	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		setSubmitHandler(document.querySelector('form'), async () => ({ status: 'accepted', message: 'Not an envelope' }));
	});
	await page.locator('button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => window.errored)).toBe(2);
	await expect(page.locator('.fs-status.fs-error')).toContainText('Unexpected response from the server.');
	await expect(page.locator('.fs-status')).not.toContainText('Not an envelope');
});

test('removing the submit handler posts to the action again', async ({ page }) => {
	await page.goto('/demos/submission.html?handler');
	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		setSubmitHandler(document.querySelector('form'), null);
	});
	await complete(page);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	await posted;
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
});

test('a submit handler runs after fs:submit and receives the form', async ({ page }) => {
	await page.goto('/demos/submission.html');
	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		const form = document.querySelector('form');
		window.order = [];
		form.addEventListener('fs:submit', () => window.order.push('fs:submit'));
		setSubmitHandler(form, async (args) => {
			window.order.push('handler');
			window.gotForm = args.form === form;
			return { formsanity: 2, status: 'accepted', message: 'Saved.' };
		});
	});
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status.fs-success')).toContainText('Saved.');
	expect(await page.evaluate(() => [window.order, window.gotForm])).toEqual([['fs:submit', 'handler'], true]);
});

test('a submit handler that fails says why in the console', async ({ page }) => {
	const logged = [];
	page.on('console', (message) => {
		if (message.type() === 'error') logged.push(message.text());
	});
	await page.goto('/demos/submission.html');
	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		setSubmitHandler(document.querySelector('form'), async () => { throw new Error('offline'); });
	});
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status.fs-error')).toBeVisible();
	await expect.poll(() => logged.filter((text) => text.includes('FormSanity: the submit handler threw') && text.includes('offline')).length).toBe(1);

	await page.evaluate(async () => {
		const { setSubmitHandler } = await import('/lib/formsanity.js');
		setSubmitHandler(document.querySelector('form'), async () => {});
	});
	await page.locator('button[type="submit"]').click();
	await expect.poll(() => logged.filter((text) => text.includes('FormSanity: the submit handler returned no envelope')).length).toBe(1);
});

for (const [label, errors] of [['an object', { email: 'taken' }], ['a null entry', [null]], ['a string entry', ['taken']]]) {
	test(`an invalid envelope whose errors hold ${label} is a protocol error`, async ({ page }) => {
		await page.goto('/demos/submission.html');
		await page.evaluate(async (errors) => {
			const { setSubmitHandler } = await import('/lib/formsanity.js');
			const form = document.querySelector('form');
			form.addEventListener('fs:error', (event) => { window.errored = event.detail.envelope; });
			form.addEventListener('fs:rejected', () => { window.rejected = true; });
			setSubmitHandler(form, async () => ({ formsanity: 2, status: 'invalid', errors }));
		}, errors);
		await complete(page);
		await page.locator('button[type="submit"]').click();
		await expect(page.locator('.fs-status.fs-error')).toContainText('Unexpected response from the server.');
		expect(await page.evaluate(() => [window.errored, window.rejected])).toEqual([{ formsanity: 2, status: 'invalid', errors }, undefined]);
		await expect(page.locator('button[type="submit"]')).toBeEnabled();
	});
}
