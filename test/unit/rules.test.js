import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRule, parseSize } from '../../lib/rules.js';

// A stand-in for a file control: checkRule only reads .files off it.
const fileField = (...sizes) => ({ name: 'attachment', controls: [{ files: sizes.map((size) => ({ size })) }] });
const fileCtx = { valueOf: () => '' };
const maxFileSize = (param, field) => checkRule({ kind: 'max-file-size', param }, field, fileCtx, 'input');

test('parseSize accepts bytes, kb, mb, gb', () => {
	assert.equal(parseSize('500b'), 500);
	assert.equal(parseSize('500KB'), 500 * 1024);
	assert.equal(parseSize('2MB'), 2 * 1024 ** 2);
	assert.equal(parseSize('1GB'), 1024 ** 3);
});

test('parseSize is case-insensitive', () => {
	assert.equal(parseSize('2mb'), 2 * 1024 ** 2);
	assert.equal(parseSize('2Mb'), 2 * 1024 ** 2);
	assert.equal(parseSize('2mB'), 2 * 1024 ** 2);
});

test('parseSize accepts decimals', () => {
	assert.equal(parseSize('1.5MB'), 1.5 * 1024 ** 2);
	assert.equal(parseSize('0.5GB'), 0.5 * 1024 ** 3);
});

test('parseSize tolerates surrounding whitespace and a space before the unit', () => {
	assert.equal(parseSize('  2MB  '), 2 * 1024 ** 2);
	assert.equal(parseSize('2 MB'), 2 * 1024 ** 2);
});

test('parseSize rejects unknown units', () => {
	assert.throws(() => parseSize('2 gigs'), /Bad size/);
});

test('parseSize rejects garbage input', () => {
	assert.throws(() => parseSize('big'), /Bad size/);
	assert.throws(() => parseSize(''), /Bad size/);
});

test('max-file-size passes an empty control and a file under the cap', () => {
	assert.equal(maxFileSize('2MB', fileField()), null);
	assert.equal(maxFileSize('2MB', fileField(1024)), null);
});

test('max-file-size rejects a file over the cap', () => {
	assert.deepEqual(maxFileSize('2MB', fileField(3 * 1024 ** 2)), {
		verdict: 'invalid',
		code: 'file.max-size',
		params: { size: '2MB' }
	});
});

test('max-file-size checks every selected file, not just the first', () => {
	assert.equal(maxFileSize('2MB', fileField(1024, 2048)), null);
	assert.equal(maxFileSize('2MB', fileField(1024, 3 * 1024 ** 2))?.code, 'file.max-size');
});

test('max-file-size accepts a file exactly at the cap', () => {
	assert.equal(maxFileSize('2MB', fileField(2 * 1024 ** 2)), null);
});

const orderedField = (type, value) => ({ name: 'f', type, controls: [{ value }] });
const orderedCtx = (value) => ({ valueOf: () => value });
const bound = (kind, param, type, value) => checkRule({ kind, param }, orderedField(type, value), orderedCtx(value), 'input');

test('duration min compares in duration order', () => {
	assert.deepEqual(bound('min-value', '2:00', 'duration', '1:30'), { verdict: 'incomplete', code: 'min', params: { n: '2:00' } });
	assert.equal(bound('min-value', '2:00', 'duration', '3:00'), null);
	assert.equal(bound('min-value', '2:00', 'duration', '10:00'), null);
});

test('duration max is a dead end past the bound', () => {
	assert.deepEqual(bound('max-value', '5:00', 'duration', '6:00'), { verdict: 'invalid', code: 'max', params: { n: '5:00' } });
	assert.equal(bound('max-value', '5:00', 'duration', '4:59'), null);
});

test('ordered bounds ignore unparsed and empty values', () => {
	assert.equal(bound('min-value', '2:00', 'duration', '1:'), null);
	assert.equal(bound('min-value', '2:00', 'duration', ''), null);
});

test('us-dollar bounds compare numerically through $ and commas', () => {
	assert.equal(bound('min-value', '$5.00', 'us-dollar', '$4.99')?.code, 'min');
	assert.equal(bound('min-value', '$5.00', 'us-dollar', '1,000'), null);
	assert.equal(bound('max-value', '$1,000.00', 'us-dollar', '$1,200')?.code, 'max');
});

test('ordered bounds no-op for unordered types', () => {
	assert.equal(bound('min-value', '2:00', 'zip', '1:30'), null);
});
