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

// A stand-in for accept checking: checkRule reads .files entries' name/type.
const filesField = (...files) => ({ name: 'upload', controls: [{ files }] });
const accept = (param, field) => checkRule({ kind: 'accept', param }, field, fileCtx, 'input');

test('accept passes an empty control and a matching extension', () => {
	assert.equal(accept('.pdf', filesField()), null);
	assert.equal(accept('.pdf', filesField({ name: 'report.pdf', type: 'application/pdf' })), null);
});

test('accept matches extensions case-insensitively, both ways', () => {
	assert.equal(accept('.pdf', filesField({ name: 'REPORT.PDF', type: '' })), null);
	assert.equal(accept('.PDF', filesField({ name: 'report.pdf', type: '' })), null);
});

test('accept rejects a wrong extension as invalid with file.accept', () => {
	const result = accept('.pdf', filesField({ name: 'notes.txt', type: 'text/plain' }));
	assert.equal(result.verdict, 'invalid');
	assert.equal(result.code, 'file.accept');
});

test('accept honors a token list: any token admits the file', () => {
	const field = filesField({ name: 'photo.jpeg', type: 'image/jpeg' });
	assert.equal(accept('.gif,.jpg,.jpeg,.png,.svg', field), null);
	assert.notEqual(accept('.gif,.png', field), null);
});

test('accept matches exact MIME types and wildcard subtypes', () => {
	const photo = filesField({ name: 'photo', type: 'image/jpeg' });
	assert.equal(accept('image/jpeg', photo), null);
	assert.equal(accept('image/*', photo), null);
	assert.notEqual(accept('video/*', photo), null);
	assert.notEqual(accept('image/png', photo), null);
});

test('accept checks every selected file, not just the first', () => {
	const field = filesField({ name: 'a.pdf', type: 'application/pdf' }, { name: 'b.txt', type: 'text/plain' });
	assert.notEqual(accept('.pdf', field), null);
});

// A stand-in for a datetime-local control carrying a daily window.
const windowField = (minTime, maxTime) => {
	const rules = [];
	if (minTime !== null) rules.push({ kind: 'min-time', param: minTime });
	if (maxTime !== null) rules.push({ kind: 'max-time', param: maxTime });
	return { name: 'meeting', rules, controls: [{}] };
};
const timeWindow = (field, value) => {
	const ctx = { valueOf: () => value };
	return field.rules.map((rule) => checkRule(rule, field, ctx, 'input')).find(Boolean) ?? null;
};

test('daily window passes an empty value and an in-window value', () => {
	const field = windowField('09:00', '17:00');
	assert.equal(timeWindow(field, ''), null);
	assert.equal(timeWindow(field, '2010-06-16T13:00'), null);
	assert.equal(timeWindow(field, '2010-06-16T09:00'), null);
	assert.equal(timeWindow(field, '2010-06-16T17:00'), null);
});

test('daily window reports under-start incomplete and past-end invalid', () => {
	const field = windowField('09:00', '17:00');
	const early = timeWindow(field, '2010-06-16T08:59');
	assert.equal(early.verdict, 'incomplete');
	assert.equal(early.code, 'min-time');
	const late = timeWindow(field, '2010-06-16T17:01');
	assert.equal(late.verdict, 'invalid');
	assert.equal(late.code, 'max-time');
});

test('each bound also works alone', () => {
	assert.equal(timeWindow(windowField('09:00', null), '2010-06-16T23:00'), null);
	assert.equal(timeWindow(windowField('09:00', null), '2010-06-16T08:00').code, 'min-time');
	assert.equal(timeWindow(windowField(null, '17:00'), '2010-06-16T04:00'), null);
	assert.equal(timeWindow(windowField(null, '17:00'), '2010-06-16T18:00').code, 'max-time');
});

test('a reversed daily window wraps midnight and reports once', () => {
	const field = windowField('22:00', '03:00');
	assert.equal(timeWindow(field, '2010-06-16T23:30'), null);
	assert.equal(timeWindow(field, '2010-06-17T02:00'), null);
	const outside = timeWindow(field, '2010-06-16T12:00');
	assert.equal(outside.verdict, 'incomplete');
	assert.equal(outside.code, 'min-time');
	assert.equal(field.rules.map((rule) => checkRule(rule, field, { valueOf: () => '2010-06-16T12:00' }, 'input')).filter(Boolean).length, 1);
});

// A stand-in ctx for cross-field comparisons: values and types by name.
const compareCtx = (values, types = {}) => ({
	valueOf: (name) => values[name] ?? '',
	typeOf: (name) => types[name] ?? null,
	labelOf: (name) => name
});
const ordering = (kind, target, ctx) => checkRule({ kind, param: target }, { name: 'self', rules: [] }, ctx, 'input');

test('not-equals-field accepts a space-separated target list', () => {
	const ctx = compareCtx({ self: 'two', first: 'one', second: 'two' });
	const rule = { kind: 'not-equals-field', param: 'first second' };
	const hit = checkRule(rule, { name: 'self', rules: [] }, ctx, 'input');
	assert.equal(hit.verdict, 'incomplete');
	assert.equal(hit.code, 'not-equals-field');
	assert.equal(hit.params.label, 'second');
	const clear = compareCtx({ self: 'three', first: 'one', second: 'two' });
	assert.equal(checkRule(rule, { name: 'self', rules: [] }, clear, 'input'), null);
});

test('ordering compares native time fields as time of day', () => {
	const late = compareCtx({ self: '17:30', opens: '09:00' }, { self: 'time', opens: 'time' });
	assert.equal(ordering('greater-than-field', 'opens', late), null);
	const early = compareCtx({ self: '08:00', opens: '09:00' }, { self: 'time', opens: 'time' });
	const hit = ordering('greater-than-field', 'opens', early);
	assert.equal(hit.verdict, 'incomplete');
	assert.equal(hit.code, 'greater-than-field.date');
});

test('ordering compares datetime-local fields chronologically', () => {
	const ctx = compareCtx(
		{ self: '2010-06-01T09:00', kickoff: '2010-06-02T09:00' },
		{ self: 'datetime-local', kickoff: 'datetime-local' }
	);
	const hit = ordering('greater-than-field', 'kickoff', ctx);
	assert.equal(hit.code, 'greater-than-field.date');
});

test('ordering compares ordered fs types in their own order', () => {
	const longer = compareCtx({ self: '10:00', base: '2:30' }, { self: 'duration', base: 'duration' });
	assert.equal(ordering('greater-than-field', 'base', longer), null);
	const shorter = compareCtx({ self: '1:30', base: '2:30' }, { self: 'duration', base: 'duration' });
	const hit = ordering('greater-than-field', 'base', shorter);
	assert.equal(hit.verdict, 'incomplete');
	assert.equal(hit.code, 'greater-than-field');
	const dollars = compareCtx({ self: '$1,500.00', base: '900' }, { self: 'us-dollar', base: 'us-dollar' });
	assert.equal(ordering('greater-than-field', 'base', dollars), null);
});
