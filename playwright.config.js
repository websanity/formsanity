import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'test/e2e',
	use: { baseURL: 'http://localhost:8347' },
	webServer: { command: 'node test/server.js', port: 8347, reuseExistingServer: true },
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
