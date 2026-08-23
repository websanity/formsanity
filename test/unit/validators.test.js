import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateType, nativeVerdict, nativeCode, luhn, canonicalize } from '../../lib/validators.js';

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

test('canonicalize rewrites valid values to the standard format', () => {
	assert.equal(canonicalize('us-phone', '303.555.1234'), '(303) 555-1234');
	assert.equal(canonicalize('us-phone', '+1 (303) 555-1234'), '(303) 555-1234');
	assert.equal(canonicalize('international-phone', '44 20 7946 0958'), '+442079460958');
	assert.equal(canonicalize('ssn', '123456789'), '123-45-6789');
	assert.equal(canonicalize('zip', '802101234'), '80210-1234');
	assert.equal(canonicalize('zip', '80210'), '80210');
	assert.equal(canonicalize('us-dollar', '$1,234.5'), '1234.50');
	assert.equal(canonicalize('us-dollar', '5.'), '5.00');
	assert.equal(canonicalize('duration', '90'), '1:30');
	assert.equal(canonicalize('duration', '2:3'), '2:03');
});

test('canonicalize returns null for not-valid values and uncanonicalized types', () => {
	assert.equal(canonicalize('ssn', '123-456'), null);
	assert.equal(canonicalize('us-phone', ''), null);
	assert.equal(canonicalize('email', 'a@b.co'), null);
});

test('credit-card treats a null param as the full network default', () => {
	assert.equal(validateType('credit-card', '4', null), 'incomplete');
	assert.equal(validateType('credit-card', '4242424242424242', null), 'valid');
});
