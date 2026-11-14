import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpression, evaluate, evaluateVerdict, dependencies, compileExpression } from '../../lib/expression.js';

const vectors = JSON.parse(readFileSync(new URL('../../vectors/expressions.json', import.meta.url)));

for (const v of vectors) {
	test(`vector: ${v.expr} with ${JSON.stringify(v.fields)}`, () => {
		// A field in a vector is a string, or an array for a field that holds a list. A bare name reads an array joined with commas, and == and != read the list.
		const list = (n) => (Array.isArray(v.fields[n]) ? v.fields[n] : null);
		const ctx = { get: (n) => list(n)?.join(',') ?? v.fields[n] ?? '', values: list, typeOf: (n) => v.types?.[n] ?? null, valid: (n) => v.valid?.[n] ?? true };
		assert.equal(evaluate(parseExpression(v.expr), ctx), v.expected);
		if (v.verdict) assert.equal(evaluateVerdict(parseExpression(v.expr), ctx), v.verdict);
	});
}

test('dependencies collects field names once', () => {
	assert.deepEqual(dependencies(parseExpression("(a == 'x' && b == 'y') || a == 'z'")).sort(), ['a', 'b']);
});

test('compileExpression bundles node, deps, evaluate', () => {
	const c = compileExpression("a == 'x'");
	assert.deepEqual(c.deps, ['a']);
	assert.equal(c.evaluate({ get: () => 'x', typeOf: () => null }), true);
});

for (const bad of ["a ==", "a = 'x'", "(a == 'x'", "'unterminated", "a === 'x'"]) {
	test(`syntax error: ${bad}`, () => {
		assert.throws(() => parseExpression(bad), SyntaxError);
	});
}

test('valid() collects its field as a dependency', () => {
	assert.deepEqual(dependencies(parseExpression("valid(password) && plan == 'x'")).sort(), ['password', 'plan']);
});

test('an unknown function name is a syntax error', () => {
	assert.throws(() => parseExpression('bogus(password)'), SyntaxError);
});

test('a comma is no token of the grammar', () => {
	assert.throws(() => parseExpression('a, b'), SyntaxError);
});

test('== without a list reader compares strings', () => {
	const ctx = { get: (n) => ({ roles: 'Driver,Medic' })[n] ?? '', typeOf: () => null };
	assert.equal(evaluate(parseExpression("roles == 'Driver'"), ctx), false);
	assert.equal(evaluate(parseExpression("roles == 'Driver,Medic'"), ctx), true);
});
