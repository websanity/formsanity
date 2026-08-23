import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const contentTypes = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp'
};

// Messages catalog kept inline so the dev server has zero dependencies on lib/.
// Wording matches lib/messages.js.
const messages = {
	'unique': 'already in use',
	'group.unique-values': 'must be unique',
	'required': 'required',
	'invalid': 'not valid'
};

function messageFor(code) {
	return messages[code] ?? 'not valid';
}

function send(res, status, payload) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ formsanity: 2, ...payload }));
}

function parseRejectList(reject) {
	if (!reject) return [];
	return reject
		.split(',')
		.map((pair) => pair.trim())
		.filter(Boolean)
		.map((pair) => {
			const [field, code] = pair.split(':').map((part) => part.trim());
			return { field, code, message: messageFor(code) };
		});
}

function parseMultipart(body, boundary) {
	const fields = {};
	const parts = body.split(`--${boundary}`);
	for (const part of parts) {
		const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
		if (!trimmed || trimmed === '--') continue;
		const headerEnd = trimmed.indexOf('\r\n\r\n');
		if (headerEnd === -1) continue;
		const headers = trimmed.slice(0, headerEnd);
		const value = trimmed.slice(headerEnd + 4);
		const nameMatch = headers.match(/name="([^"]*)"/);
		if (!nameMatch) continue;
		const filenameMatch = headers.match(/filename="([^"]*)"/);
		if (filenameMatch) {
			// File part: keep the filename, discard the bytes.
			fields[nameMatch[1]] = filenameMatch[1];
		} else {
			fields[nameMatch[1]] = value;
		}
	}
	return fields;
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

async function parseFields(req) {
	const contentType = req.headers['content-type'] ?? '';
	const buffer = await readBody(req);

	if (contentType.includes('multipart/form-data')) {
		const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
		const boundary = boundaryMatch ? (boundaryMatch[1] ?? boundaryMatch[2]) : '';
		return parseMultipart(buffer.toString('binary'), boundary);
	}

	if (contentType.includes('application/json')) {
		const text = buffer.toString('utf8');
		if (!text) return {};
		try {
			return JSON.parse(text);
		} catch {
			return {};
		}
	}

	if (contentType.includes('application/x-www-form-urlencoded')) {
		const params = new URLSearchParams(buffer.toString('utf8'));
		return Object.fromEntries(params);
	}

	return {};
}

// Rate-limit bookkeeping for /api/unique: every third call within a 2s
// window returns 429.
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

const takenValues = new Set(['taken@example.com', 'taken']);

function serveStatic(req, res) {
	const url = new URL(req.url, 'http://localhost');
	let pathname;

	try {
		pathname = decodeURIComponent(url.pathname);
	} catch {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		res.end('Bad request');
		return;
	}

	if (pathname.includes('..')) {
		res.writeHead(403, { 'Content-Type': 'text/plain' });
		res.end('Forbidden');
		return;
	}

	if (pathname.includes('\0')) {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		res.end('Bad request');
		return;
	}

	if (pathname === '/') pathname = '/index.html';

	const filePath = path.join(repoRoot, pathname);

	try {
		fs.readFile(filePath, (err, data) => {
			if (err) {
				res.writeHead(404, { 'Content-Type': 'text/plain' });
				res.end('Not found');
				return;
			}
			const ext = path.extname(filePath);
			const contentType = contentTypes[ext] ?? 'application/octet-stream';
			res.writeHead(200, { 'Content-Type': contentType });
			res.end(data);
		});
	} catch {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		res.end('Bad request');
	}
}

async function handleSubmit(req, res, scenario) {
	const fields = await parseFields(req);

	if (scenario === 'invalid') {
		const errors = fields.reject
			? parseRejectList(fields.reject)
			: [{ field: 'email', code: 'unique', message: messageFor('unique') }];
		send(res, 422, { status: 'invalid', errors });
		return;
	}

	if (scenario === 'redirect') {
		send(res, 200, { status: 'accepted', redirect: '/instrumentation/submitted.html' });
		return;
	}

	if (scenario === 'error') {
		send(res, 500, { status: 'error', message: 'Could not store submission' });
		return;
	}

	send(res, 200, { status: 'accepted', message: 'Thanks!' });
}

async function handleUnique(req, res) {
	const fields = await parseFields(req);

	if (isRateLimited()) {
		res.writeHead(429, { 'Content-Type': 'application/json' });
		res.end();
		return;
	}

	const unique = !takenValues.has(fields.value);
	send(res, 200, { unique });
}

export function createServer() {
	return http.createServer((req, res) => {
		const url = new URL(req.url, 'http://localhost');

		if (req.method === 'POST' && url.pathname === '/api/submit') {
			handleSubmit(req, res, url.searchParams.get('scenario')).catch(() => {
				send(res, 500, { status: 'error', message: 'Could not store submission' });
			});
			return;
		}

		if (req.method === 'POST' && url.pathname === '/api/unique') {
			handleUnique(req, res).catch(() => {
				send(res, 500, { status: 'error', message: 'Could not store submission' });
			});
			return;
		}

		if (req.method === 'GET') {
			serveStatic(req, res);
			return;
		}

		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not found');
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = process.env.PORT ?? 8347;
	const server = createServer();
	server.listen(port, () => {
		console.log(`FormSanity dev server listening on http://localhost:${port}`);
	});
}
