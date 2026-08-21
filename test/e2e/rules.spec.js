import { test, expect } from '@playwright/test';

test('confirm mismatch is a dead end when not a prefix', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hx');
	await expect(page.locator('li:has(#confirm)')).toHaveClass(/fs-invalid/);
});

test('confirm prefix stays quiet until blur', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hun');
	await expect(page.locator('li:has(#confirm) .fs-error')).toHaveCount(0);
});

test('date comparison is chronological with date wording', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#start').fill('2026-09-01');
	await page.locator('#end').fill('2026-08-01');
	await page.locator('#end').blur();
	await expect(page.locator('li:has(#end) .fs-error')).toContainText('after');
});

test('password composition counts character classes', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#new-password').fill('alllowercase1');
	await page.locator('#new-password').blur();
	await expect(page.locator('li:has(#new-password) .fs-error')).toContainText('uppercase');
});

test('file size cap', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#attachment').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3 * 1024 * 1024) });
	await expect(page.locator('li:has(#attachment)')).toHaveClass(/fs-invalid/);
});

test('duration bounds compare in duration order end to end', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const range = page.locator('#duration-range');
	await range.fill('1:30');
	await range.blur();
	await expect(page.locator('li:has(#duration-range) .fs-error')).toContainText('minimum of 2:00');
	await range.fill('6:00');
	await expect(page.locator('li:has(#duration-range)')).toHaveClass(/fs-invalid/);
	await expect(page.locator('li:has(#duration-range) .fs-error')).toContainText('maximum of 5:00');
	await range.fill('3:00');
	await expect(page.locator('li:has(#duration-range)')).toHaveClass(/fs-valid/);
});

test('a dollar minimum reads the dollar format', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#donation').fill('4');
	await page.locator('#donation').blur();
	await expect(page.locator('li:has(#donation) .fs-error')).toContainText('minimum of $5.00');
});

test('a reversed native time range wraps midnight', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#overnight').fill('23:00');
	await expect(page.locator('li:has(#overnight)')).toHaveClass(/fs-valid/);
	await page.locator('#overnight').fill('12:00');
	await expect(page.locator('li:has(#overnight)')).toHaveClass(/fs-(incomplete|invalid)/);
});

test('time bound bubbles speak the locale presentation, not the raw value', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#business-hours').fill('08:00');
	await page.locator('#business-hours').blur();
	// en-US formats as 9:00 AM (possibly with a narrow no-break space); the
	// raw attribute value 09:00 must not leak into the bubble.
	await expect(page.locator('li:has(#business-hours) .fs-error')).toContainText(/9:00\sAM/);
	await expect(page.locator('li:has(#business-hours) .fs-error')).not.toContainText('09:00');
});

test('date bound bubbles speak the locale presentation, not the raw value', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#min-date').fill('2010-02-20');
	await page.locator('#min-date').blur();
	await expect(page.locator('li:has(#min-date) .fs-error')).toContainText('2/21/2010');
	await expect(page.locator('li:has(#min-date) .fs-error')).not.toContainText('2010-02-21');
});

test('datetime-local bound bubbles speak the locale presentation', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#june-meeting').fill('2010-05-01T08:00');
	await page.locator('#june-meeting').blur();
	await expect(page.locator('li:has(#june-meeting) .fs-error')).toContainText(/6\/1\/2010, 9:00\sAM/);
});

test('accept rejects a file the picker filter would have hidden', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const input = page.locator('#pdf-only');
	await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
	await expect(page.locator('li:has(#pdf-only)')).toHaveClass(/fs-invalid/);
	await expect(page.locator('li:has(#pdf-only) .fs-error')).toContainText('incorrect file type');
	await input.setInputFiles({ name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
	await expect(page.locator('li:has(#pdf-only)')).toHaveClass(/fs-valid/);
});

test('a daily time window constrains the time-of-day component', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	const input = page.locator('#june-meeting');
	await input.fill('2010-06-16T13:00');
	await expect(page.locator('li:has(#june-meeting)')).toHaveClass(/fs-valid/);
	await input.fill('2010-06-16T20:00');
	await expect(page.locator('li:has(#june-meeting)')).toHaveClass(/fs-invalid/);
	await expect(page.locator('li:has(#june-meeting) .fs-error')).toContainText(/no later than 5:00\sPM each day/);
	await input.fill('2010-06-16T08:00');
	await input.blur();
	await expect(page.locator('li:has(#june-meeting)')).toHaveClass(/fs-incomplete/);
	await expect(page.locator('li:has(#june-meeting) .fs-error')).toContainText(/no earlier than 9:00\sAM each day/);
});
