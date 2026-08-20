import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

let server;
let base;

before(async () => {
	server = createServer();
	await new Promise((resolve) => server.listen(0, resolve));
	base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('accepts a JSON submission', async () => {
	const res = await fetch(`${base}/api/submit`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'a@b.co' })
	});
	assert.equal(res.status, 200);
	const data = await res.json();
	assert.equal(data.formsanity, 2);
	assert.equal(data.status, 'accepted');
});

test('rejects with per-field errors', async () => {
	const res = await fetch(`${base}/api/submit?scenario=invalid`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'a@b.co', reject: 'email:unique' })
	});
	assert.equal(res.status, 422);
	const data = await res.json();
	assert.equal(data.status, 'invalid');
	assert.deepEqual(data.errors[0], { field: 'email', code: 'unique', message: 'already in use' });
});

test('rejects with default error when no reject field given', async () => {
	const res = await fetch(`${base}/api/submit?scenario=invalid`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'a@b.co' })
	});
	assert.equal(res.status, 422);
	const data = await res.json();
	assert.equal(data.status, 'invalid');
	assert.deepEqual(data.errors, [{ field: 'email', code: 'unique', message: 'already in use' }]);
});

test('redirect scenario', async () => {
	const res = await fetch(`${base}/api/submit?scenario=redirect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	const data = await res.json();
	assert.equal(data.status, 'accepted');
	assert.equal(data.redirect, '/instrumentation/submitted.html');
});

test('error scenario', async () => {
	const res = await fetch(`${base}/api/submit?scenario=error`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	assert.equal(res.status, 500);
	assert.equal((await res.json()).status, 'error');
});

test('unique endpoint', async () => {
	const res = await fetch(`${base}/api/unique`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'email', value: 'taken@example.com' }) });
	const data = await res.json();
	assert.equal(data.formsanity, 2);
	assert.equal(data.unique, false);
});

test('serves static files', async () => {
	const res = await fetch(`${base}/lib/expression.js`);
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type'), /javascript/);
});
