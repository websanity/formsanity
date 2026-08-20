import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateType, nativeVerdict, nativeCode, luhn } from '../../lib/validators.js';

const vectors = JSON.parse(readFileSync(new URL('../../vectors/validators.json', import.meta.url)));

for (const v of vectors) {
	test(`${v.type}: "${v.value}" → ${v.expected}`, () => {
		assert.equal(validateType(v.type, v.value, v.param), v.expected);
	});
}

test('luhn', () => {
	assert.equal(luhn('4242424242424242'), true);
	assert.equal(luhn('4242424242424241'), false);
});

test('nativeVerdict maps ValidityState-shaped objects', () => {
	const state = (overrides) => ({ valid: false, badInput: false, rangeOverflow: false, stepMismatch: false, tooLong: false, valueMissing: false, tooShort: false, rangeUnderflow: false, typeMismatch: false, patternMismatch: false, ...overrides });
	assert.equal(nativeVerdict(state({ valid: true })), 'valid');
	assert.equal(nativeVerdict(state({ badInput: true })), 'invalid');
	assert.equal(nativeVerdict(state({ rangeOverflow: true })), 'invalid');
	assert.equal(nativeVerdict(state({ stepMismatch: true })), 'invalid');
	assert.equal(nativeVerdict(state({ valueMissing: true })), 'incomplete');
	assert.equal(nativeVerdict(state({ tooShort: true })), 'incomplete');
	assert.equal(nativeCode(state({ valueMissing: true })), 'required');
	assert.equal(nativeCode(state({ rangeUnderflow: true })), 'min');
	assert.equal(nativeCode(state({ valid: true })), null);
});
