// Loads the built dist/ artifacts into a browser page and asserts the engine initializes, gates the submit button, and releases it when the form validates.
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const page_html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>dist check</title>
	<link rel="stylesheet" href="/formsanity.css">
	<script type="module">
		import { init } from '/formsanity.js';
		init();
	</script>
</head>
<body>
	<form data-fs-form action="/api/submit" method="post">
		<fieldset>
			<legend>Check</legend>
			<ul>
				<li>
					<label for="email">Email</label>
					<input id="email" name="email" type="text" data-fs-type="email" required>
				</li>
			</ul>
		</fieldset>
		<button type="submit">Submit</button>
	</form>
</body>
</html>`;

const files = {
	'/formsanity.js': { type: 'text/javascript', body: await readFile('dist/formsanity.js', 'utf8') },
	'/formsanity.css': { type: 'text/css', body: await readFile('dist/formsanity.css', 'utf8') },
};

const banner = `/* FormSanity ${process.env.npm_package_version ?? JSON.parse(await readFile('package.json', 'utf8')).version} */`;
for (const [path, file] of Object.entries(files)) {
	if (!file.body.startsWith(banner)) throw new Error(`${path} does not open with the banner ${banner}`);
}

const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	page.on('pageerror', (error) => { throw error; });
	await page.route('**/*', (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: page_html });
		const file = files[pathname];
		if (file) return route.fulfill({ contentType: file.type, body: file.body });
		return route.fulfill({ status: 404, body: '' });
	});
	await page.goto('http://dist.check/');

	await page.waitForSelector('form.fs-form', { timeout: 5000 });
	await page.waitForFunction(() => document.querySelector('button[type="submit"]').disabled, null, { timeout: 5000 });
	await page.fill('#email', 'jans@websanity.com');
	await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled, null, { timeout: 5000 });
} finally {
	await browser.close();
}
