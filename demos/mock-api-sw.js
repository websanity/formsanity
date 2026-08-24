// GitHub Pages serves the demos as static files with no backend, so the demo
// pages register this service worker there. It answers the dev server's API
// routes with the same envelopes test/server.js sends, submission scenarios,
// uniqueness check, and deliberate rate limiting included.

const takenValues = new Set(['taken@example.com', 'taken']);

// Rate-limit bookkeeping for /api/unique: every third call within a 2s
// window returns 429. The counters reset when the worker is put to sleep,
// which a quick burst — the walkthrough's "do it three times fast" — outlives.
let uniqueCallCount = 0;
let uniqueWindowStart = 0;

function isRateLimited() {
	const now = Date.now();
	if (now - uniqueWindowStart > 2000) {
		uniqueWindowStart = now;
		uniqueCallCount = 0;
	}
	uniqueCallCount += 1;
	return uniqueCallCount % 3 === 0;
}

function envelope(status, payload) {
	return new Response(JSON.stringify({ formsanity: 2, ...payload }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function submitResponse(scenario) {
	if (scenario === 'invalid') {
		return envelope(422, { status: 'invalid', errors: [{ field: 'email', code: 'unique', message: 'already in use' }] });
	}
	if (scenario === 'redirect') {
		// Relative, so the client resolves it against the submitting page
		// wherever the site is mounted.
		return envelope(200, { status: 'accepted', redirect: 'submitted.html' });
	}
	if (scenario === 'error') {
		return envelope(500, { status: 'error', message: 'Could not store submission' });
	}
	return envelope(200, { status: 'accepted', message: 'Thanks!' });
}

async function uniqueResponse(request) {
	if (isRateLimited()) {
		return new Response(null, { status: 429 });
	}
	const { value } = await request.json();
	return envelope(200, { unique: !takenValues.has(value) });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'POST') return;
	if (url.pathname === '/api/submit') {
		event.respondWith(submitResponse(url.searchParams.get('scenario')));
	} else if (url.pathname === '/api/unique') {
		event.respondWith(uniqueResponse(event.request));
	}
});
