import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPreSubmitHook, runHooks, setSubmitHandler, submitHandlerOf, SubmitAbort } from '../../lib/hooks.js';

test('pre-submit hooks merge their keys over the payload in registration order', async () => {
	const form = {};
	addPreSubmitHook(form, () => ({ token: 'a', extra: 1 }));
	addPreSubmitHook(form, ({ payload }) => ({ token: `${payload.token}b` }));
	assert.deepEqual(await runHooks(form, { email: 'x' }), { email: 'x', token: 'ab', extra: 1 });
});

test('a form holds one submit handler: a later one replaces it, and null removes it', () => {
	const form = {};
	const first = async () => null;
	const second = async () => null;
	assert.equal(submitHandlerOf(form), null);
	setSubmitHandler(form, first);
	setSubmitHandler(form, second);
	assert.equal(submitHandlerOf(form), second);
	setSubmitHandler(form, null);
	assert.equal(submitHandlerOf(form), null);
	assert.equal(submitHandlerOf({}), null);
});

test('a submit handler is a function: any other value but null and undefined throws', () => {
	const form = {};
	const handler = async () => null;
	setSubmitHandler(form, handler);
	for (const value of [{}, 'save', 0, '', false]) assert.throws(() => setSubmitHandler(form, value), TypeError);
	assert.equal(submitHandlerOf(form), handler);
	setSubmitHandler(form, undefined);
	assert.equal(submitHandlerOf(form), null);
});

test('a hook that throws stops the hooks after it, and the thrown value reaches the caller', async () => {
	const form = {};
	let later = false;
	addPreSubmitHook(form, async () => { throw new SubmitAbort('Your card number is incomplete.'); });
	addPreSubmitHook(form, () => { later = true; });
	await assert.rejects(runHooks(form, {}), (error) => error instanceof SubmitAbort && error instanceof Error && error.name === 'SubmitAbort' && error.message === 'Your card number is incomplete.');
	assert.equal(later, false);
});

test('a SubmitAbort with no argument carries no message', () => {
	assert.equal(new SubmitAbort().message, '');
});
