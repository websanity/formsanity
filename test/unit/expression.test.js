import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpression, evaluate, evaluateVerdict, dependencies, compileExpression } from '../../lib/expression.js';

const vectors = JSON.parse(readFileSync(new URL('../../vectors/expressions.json', import.meta.url)));

for (const v of vectors) {
	test(`vector: ${v.expr} with ${JSON.stringify(v.fields)}`, () => {
		const ctx = { get: (n) => v.fields[n] ?? '', typeOf: (n) => v.types?.[n] ?? null, valid: (n) => v.valid?.[n] ?? true };
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
