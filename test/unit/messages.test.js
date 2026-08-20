import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFor, catalog, formMessages } from '../../lib/messages.js';

test('plain code', () => {
	assert.equal(messageFor('required'), 'required');
});

test('interpolation', () => {
	assert.equal(messageFor('minlength', { n: 8 }), 'minimum of 8 characters');
	assert.equal(messageFor('equals-field', { label: 'Password' }), 'must be equal to Password');
});

test('date-aware comparison message', () => {
	assert.equal(messageFor('greater-than-field.date', { label: 'Start' }), 'must be after Start');
});

test('unknown code falls back', () => {
	assert.equal(messageFor('mystery'), 'not valid');
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
