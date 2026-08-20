import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server.js';

let server;
let base;
let port;

before(async () => {
	server = createServer();
	await new Promise((resolve) => server.listen(0, resolve));
	port = server.address().port;
	base = `http://localhost:${port}`;
});
after(() => server.close());

// fetch pre-normalizes/rejects malformed percent-escapes before the
// request ever leaves the process, so these vectors are sent with a raw
// http.request instead — matching what a real malicious client could send.
function rawRequest(rawPath) {
	return new Promise((resolve, reject) => {
		const req = http.request({ host: 'localhost', port, path: rawPath, method: 'GET' }, (res) => {
			res.resume();
			res.on('end', () => resolve(res.statusCode));
		});
		req.on('error', reject);
		req.end();
	});
}

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

test('malformed percent-encoding returns 400 and the server survives', async () => {
	assert.equal(await rawRequest('/%A0'), 400);
	const follow = await fetch(`${base}/lib/expression.js`);
	assert.equal(follow.status, 200);
});

test('embedded null byte returns 400 and the server survives', async () => {
	assert.equal(await rawRequest('/%00'), 400);
	const follow = await fetch(`${base}/lib/expression.js`);
	assert.equal(follow.status, 200);
});
