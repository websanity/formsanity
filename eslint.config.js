import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: { window: 'readonly', document: 'readonly', fetch: 'readonly', FormData: 'readonly', CustomEvent: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' }
		},
		rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
	}
];
