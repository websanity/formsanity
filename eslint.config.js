import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: { window: 'readonly', document: 'readonly', getComputedStyle: 'readonly', fetch: 'readonly', FormData: 'readonly', CustomEvent: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', queueMicrotask: 'readonly' }
		},
		rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
	}
];
