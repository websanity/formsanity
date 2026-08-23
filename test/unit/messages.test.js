import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFor, catalog, formMessages } from '../../lib/messages.js';

test('plain code', () => {
	assert.equal(messageFor('required'), 'required');
});

test('interpolation', () => {
	assert.equal(messageFor('minlength', { n: 8 }), 'minimum of 8 characters');
});

test('an author constraint message overrides the catalog', () => {
	assert.equal(messageFor('constraint', { message: 'Passwords do not match.' }), 'Passwords do not match.');
	assert.equal(messageFor('constraint', {}), 'not an allowed answer');
});

test('unknown code falls back', () => {
	assert.equal(messageFor('mystery'), 'not valid');
});

// Neither code is ever raised by the client: file.accept is advisory and
// relevance is server-side only. Both still need catalog entries so a server
// that sends one gets real prose rather than the generic fallback.
test('server-only codes have messages of their own', () => {
	assert.equal(messageFor('file.accept'), 'incorrect file type');
	assert.equal(messageFor('relevance'), 'not applicable');
	assert.notEqual(messageFor('file.accept'), messageFor('mystery'));
	assert.notEqual(messageFor('relevance'), messageFor('mystery'));
});

test('form messages exist', () => {
	assert.ok(formMessages.incomplete.length > 0);
	assert.ok(formMessages.invalid.length > 0);
});

test('catalog is replaceable', () => {
	const old = catalog.required;
	catalog.required = 'requerido';
	assert.equal(messageFor('required'), 'requerido');
	catalog.required = old;
});
