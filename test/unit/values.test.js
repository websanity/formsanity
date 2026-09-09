import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldValue, fieldValues } from '../../lib/values.js';

// Stand-ins for controls: the readers touch only type, value, checked, disabled, matches, and selectedOptions.
const box = (value, checked, disabled = false) => ({ type: 'checkbox', value, checked, disabled, matches: () => false });
const set = (...controls) => ({ name: 'roles', controls });
const option = (value, disabled = false) => ({ value, disabled });
const list = (...options) => ({ name: 'colors', controls: [{ type: 'select-multiple', matches: (s) => s === 'select[multiple]', selectedOptions: options }] });

test('a set reads its checked members in document order', () => {
	const field = set(box('a', true), box('b', false), box('c', true));
	assert.deepEqual(fieldValues(field), ['a', 'c']);
	assert.equal(fieldValue(field), 'a,c');
});

test('a set with nothing checked reads as empty', () => {
	const field = set(box('a', false), box('b', false));
	assert.deepEqual(fieldValues(field), []);
	assert.equal(fieldValue(field), '');
});

test('a checked member that is disabled counts for nothing', () => {
	const field = set(box('a', true, true), box('b', false), box('c', true));
	assert.deepEqual(fieldValues(field), ['c']);
	assert.equal(fieldValue(field), 'c');
});

test('a multi-select reads its selected options and skips disabled ones', () => {
	const field = list(option('Red'), option('Blue', true), option('Green'));
	assert.deepEqual(fieldValues(field), ['Red', 'Green']);
	assert.equal(fieldValue(field), 'Red,Green');
});

test('a text control reads its value as a string', () => {
	const field = { name: 'city', controls: [{ type: 'text', value: 'Boston', matches: () => false }] };
	assert.equal(fieldValues(field), 'Boston');
	assert.equal(fieldValue(field), 'Boston');
});
