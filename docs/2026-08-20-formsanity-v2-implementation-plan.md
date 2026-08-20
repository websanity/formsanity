# FormSanity v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FormSanity v2 library (ES modules + stylesheet), its vocabulary and submission protocol specs, instrumentation pages, and ported example forms, per the approved design.

**Architecture:** A dependency-free client engine reads `data-fs-*` and native constraint attributes from developer-authored markup and brings the form to life: three-state validation, relevance, gating, and protocol-conformant submission. Pure logic (validators, expressions) is node-tested against shared JSON vectors; everything DOM-touching is Playwright-tested against instrumentation pages served by a reference dev server that implements the submission protocol.

**Tech Stack:** Vanilla ES modules (no build), plain CSS (cascade layer + custom properties), `node:test`, Playwright, ESLint. Zero production dependencies.

**Spec:** `docs/2026-08-20-formsanity-v2-design.md` (the design; where it disagrees with the charter, the design wins).

## Global Constraints

- **No production dependencies.** devDependencies are exactly `@playwright/test` and `eslint`.
- **No build step.** `lib/` is the distribution; never create a `dist/` or a bundler config.
- **Browser floor: Baseline Widely Available.** No syntax or API outside it. Container size queries, subgrid, native nesting, and `@layer` are in; container style queries and CSS module scripts are out.
- **All FormSanity attributes use the `data-fs-` prefix.** Layout uses classes (`block`, `cols`, `col-break`, `compound`, `toggle-list`, `buttons`), never data attributes.
- **All HTML and CSS work MUST follow the `writing-html-css` skill** (invoke it before writing any page or stylesheet). One deliberate exception, recorded in the design: the shipped stylesheet lives in `@layer formsanity` because the library is framework CSS from a consuming site's perspective.
- **Indentation is tabs** in JS, HTML, CSS, and JSON.
- **Markdown docs:** never hard-wrap paragraphs; pad table pipes; every heading followed by content.
- **Commits:** Conventional Commits, no AI attribution, commit at the end of every task (and at any green intermediate step you like).
- **Engine internals** (classes and elements the engine writes) use the `fs-` prefix: `fs-error`, `fs-status`, `fs-valid`, `fs-incomplete`, `fs-invalid`, `fs-irrelevant`, `fs-counter`, `fs-reveal`.
- The v1 repo `~/dev/websanity-meta/formsanity-client/` is read-only reference. Never modify it.

## Verdicts, Codes, and Rule Behavior (shared reference)

Every validation check yields a **verdict**: `valid`, `incomplete` (could become valid by appending characters), or `invalid` (dead end). At submit time `incomplete` collapses into invalid. Timing: `invalid` presents immediately on input; `incomplete` presents on blur; a field that has presented an error re-validates on every input.

Error **codes** are shared by the engine, the protocol, and the message catalog:

| Code                                             | Source                                       | Violation verdict                                        |
|--------------------------------------------------|----------------------------------------------|----------------------------------------------------------|
| `required`                                       | `required` empty                             | `incomplete`                                             |
| `type.<name>`                                    | `data-fs-type` (per prefix pattern)          | `incomplete` or `invalid` per three-state check          |
| `minlength` / `maxlength`                        | native                                       | `incomplete` / `invalid`                                 |
| `min` / `max` / `step` / `badinput`              | native                                       | `incomplete` / `invalid` / `invalid` / `invalid`         |
| `pattern` / `type.native`                        | native (`patternMismatch` / `typeMismatch`)  | `incomplete`                                             |
| `equals` / `equals-field`                        | value must equal literal / other field       | `invalid` when not a prefix of target, else `incomplete` |
| `not-equals` / `not-equals-field`                | must differ                                  | `incomplete`                                             |
| `greater-than-field` / `less-than-field`         | numeric, chronological when both dates       | `incomplete`                                             |
| `min-digits` / `min-uppercase` / `min-lowercase` | password composition                         | `incomplete`                                             |
| `group.at-least-one` / `group.all-or-none`       | group membership                             | `incomplete`                                             |
| `min-selected` / `max-selected`                  | checkbox sets                                | `incomplete` / `invalid`                                 |
| `file.max-size`                                  | `data-fs-max-file-size`                      | `invalid`                                                |
| `unique` / `unique-in-page`                      | server check / page check                    | `invalid`                                                |
| `relevance`                                      | server-side only: value for irrelevant field | n/a client-side                                          |

## File Structure

| Path                                                       | Responsibility                                                                                       |
|------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `lib/formsanity.js`                                        | Entry: `init(root)`, per-form orchestration                                                          |
| `lib/expression.js`                                        | Expression tokenizer, parser, evaluator, `dependencies()`                                            |
| `lib/validators.js`                                        | Three-state type validators, `nativeVerdict()`, rule checks                                          |
| `lib/messages.js`                                          | Default en message catalog + `format()`                                                              |
| `lib/parse.js`                                             | Markup → rule model (`parseForm`)                                                                    |
| `lib/fields.js`                                            | Per-field state, verdict merge, timing                                                               |
| `lib/relevance.js`                                         | Dependency graph, irrelevance application                                                            |
| `lib/errors.js`                                            | Error bubbles, row state classes, form status region                                                 |
| `lib/submit.js`                                            | Gate, gather, fetch, envelope handling, uniqueness client                                            |
| `lib/hooks.js`                                             | `addPreSubmitHook`, event dispatch helpers                                                           |
| `lib/behaviors.js`                                         | copy-to, amount, year/month options, reveal, counter, when-valid                                     |
| `lib/formsanity.css`                                       | Shipped stylesheet (`@layer formsanity`)                                                             |
| `vectors/expressions.json`                                 | Shared expression test vectors (JS + future PHP)                                                     |
| `vectors/validators.json`                                  | Shared three-state validator vectors                                                                 |
| `specs/vocabulary.md`                                      | Vocabulary spec (product artifact)                                                                   |
| `specs/submission-protocol.md`                             | Protocol spec (product artifact)                                                                     |
| `instrumentation/*.html` + `instrumentation.css`           | Reference pages: index, types, limits, comparisons, relevance, operations, choice-groups, submission |
| `forms/*.html`                                             | Ported v1 mock forms                                                                                 |
| `test/unit/*.test.js`                                      | `node:test` suites                                                                                   |
| `test/e2e/*.spec.js`                                       | Playwright suites                                                                                    |
| `test/server.js`                                           | Reference dev server (protocol implementation + static files)                                        |
| `package.json`, `eslint.config.js`, `playwright.config.js` | Tooling                                                                                              |

Execution order: Tasks 1–4 are pure-node; 5 stands up the browser harness; 6–14 build the engine feature-by-feature, each delivering its instrumentation page and e2e specs; 15–16 the stylesheet; 17–18 the spec documents; 19 the ported forms; 20 the wrap-up.

---

### Task 1: Scaffolding + expression engine

**Files:**
- Create: `package.json`, `eslint.config.js`, `lib/expression.js`, `vectors/expressions.json`, `test/unit/expression.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseExpression(src) → node` (throws `SyntaxError`), `dependencies(node) → string[]`, `evaluate(node, ctx) → boolean` with `ctx = {get(name) → string, typeOf(name) → string|null}`, `compileExpression(src) → {node, deps, evaluate(ctx)}`. Node kinds: `or|and|not|cmp|name|string|number`.

- [ ] **Step 1: Write `package.json` and `eslint.config.js`**

```json
{
	"name": "formsanity",
	"version": "2.0.0-dev",
	"type": "module",
	"scripts": {
		"test": "node --test test/unit/",
		"test:e2e": "playwright test",
		"lint": "eslint .",
		"serve": "node test/server.js"
	},
	"devDependencies": {
		"@playwright/test": "^1.46.0",
		"eslint": "^9.9.0"
	}
}
```

```js
import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: { window: 'readonly', document: 'readonly', fetch: 'readonly', FormData: 'readonly', CustomEvent: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' }
		},
		rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
	}
];
```

Run `npm install`.

- [ ] **Step 2: Write the failing test — vector runner + parse errors**

`vectors/expressions.json` seed (grow it as the grammar lands; each entry is one shared JS/PHP conformance case):

```json
[
	{ "expr": "color != ''", "fields": { "color": "" }, "expected": false },
	{ "expr": "color != ''", "fields": { "color": "red" }, "expected": true },
	{ "expr": "(a == 'x' && b == 'y') || c == 'z'", "fields": { "a": "x", "b": "y", "c": "" }, "expected": true },
	{ "expr": "(a == 'x' && b == 'y') || c == 'z'", "fields": { "a": "x", "b": "n", "c": "" }, "expected": false },
	{ "expr": "!(a == 'x')", "fields": { "a": "y" }, "expected": true },
	{ "expr": "qty > 3", "fields": { "qty": "10" }, "expected": true },
	{ "expr": "qty > 3", "fields": { "qty": "" }, "expected": false },
	{ "expr": "start < end", "fields": { "start": "2026-01-02", "end": "2026-02-01" }, "types": { "start": "date", "end": "date" }, "expected": true },
	{ "expr": "start < end", "fields": { "start": "2026-03-02", "end": "2026-02-01" }, "types": { "start": "date", "end": "date" }, "expected": false },
	{ "expr": "n >= 2 && n <= 5", "fields": { "n": "5" }, "expected": true },
	{ "expr": "name == 'O''Brien'", "fields": { "name": "O'Brien" }, "expected": true }
]
```

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseExpression, evaluate, dependencies, compileExpression } from '../../lib/expression.js';

const vectors = JSON.parse(readFileSync(new URL('../../vectors/expressions.json', import.meta.url)));

for (const v of vectors) {
	test(`vector: ${v.expr} with ${JSON.stringify(v.fields)}`, () => {
		const ctx = { get: (n) => v.fields[n] ?? '', typeOf: (n) => v.types?.[n] ?? null };
		assert.equal(evaluate(parseExpression(v.expr), ctx), v.expected);
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
```

- [ ] **Step 3: Run to verify failure** — `npm test`. Expected: FAIL (cannot find `lib/expression.js`).

- [ ] **Step 4: Implement `lib/expression.js`**

Grammar (this text is copied into `specs/vocabulary.md` in Task 17):

```
expr       := or
or         := and ( '||' and )*
and        := unary ( '&&' unary )*
unary      := '!' unary | primary
primary    := operand ( ( '==' | '!=' | '<=' | '>=' | '<' | '>' ) operand )?
operand    := name | string | number | '(' expr ')'
name       := [A-Za-z_] [A-Za-z0-9_-]*
string     := "'" ( [^'] | "''" )* "'"     — '' is an escaped quote
number     := '-'? [0-9]+ ( '.' [0-9]+ )?
```

Semantics: a bare `name` reads the field's value (empty string when unanswered). `==`/`!=` compare as strings after both sides stringify. Ordering operators compare chronologically when either side is a `date`-typed field (an unparseable or empty date makes the comparison false), numerically when both sides parse as numbers, and otherwise are false.

```js
export function parseExpression(src) {
	const tokens = tokenize(src);
	let pos = 0;
	const peek = () => tokens[pos];
	const eat = (type) => {
		const t = tokens[pos];
		if (!t || t.type !== type) {
			throw new SyntaxError(`Expected ${type} at position ${t ? t.at : src.length} in "${src}"`);
		}
		pos += 1;
		return t;
	};
	function or() {
		let node = and();
		while (peek()?.type === '||') { eat('||'); node = { kind: 'or', left: node, right: and() }; }
		return node;
	}
	function and() {
		let node = unary();
		while (peek()?.type === '&&') { eat('&&'); node = { kind: 'and', left: node, right: unary() }; }
		return node;
	}
	function unary() {
		if (peek()?.type === '!') { eat('!'); return { kind: 'not', operand: unary() }; }
		return primary();
	}
	function primary() {
		const left = operand();
		const t = peek();
		if (t && ['==', '!=', '<=', '>=', '<', '>'].includes(t.type)) {
			eat(t.type);
			return { kind: 'cmp', op: t.type, left, right: operand() };
		}
		return left;
	}
	function operand() {
		const t = peek();
		if (!t) throw new SyntaxError(`Unexpected end of expression in "${src}"`);
		if (t.type === '(') { eat('('); const node = or(); eat(')'); return node; }
		if (t.type === 'name') { eat('name'); return { kind: 'name', name: t.value }; }
		if (t.type === 'string') { eat('string'); return { kind: 'string', value: t.value }; }
		if (t.type === 'number') { eat('number'); return { kind: 'number', value: t.value }; }
		throw new SyntaxError(`Unexpected ${t.type} at position ${t.at} in "${src}"`);
	}
	const node = or();
	if (pos < tokens.length) throw new SyntaxError(`Trailing input at position ${tokens[pos].at} in "${src}"`);
	return node;
}

function tokenize(src) {
	const out = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (/\s/.test(ch)) { i += 1; continue; }
		const two = src.slice(i, i + 2);
		if (two === '==' && src[i + 2] === '=') throw new SyntaxError(`Unknown operator === at position ${i}`);
		if (['&&', '||', '==', '!=', '<=', '>='].includes(two)) { out.push({ type: two, at: i }); i += 2; continue; }
		if ('!<>()'.includes(ch)) { out.push({ type: ch, at: i }); i += 1; continue; }
		if (ch === "'") {
			let value = '';
			let j = i + 1;
			for (;;) {
				if (j >= src.length) throw new SyntaxError(`Unterminated string at position ${i}`);
				if (src[j] === "'" && src[j + 1] === "'") { value += "'"; j += 2; continue; }
				if (src[j] === "'") break;
				value += src[j];
				j += 1;
			}
			out.push({ type: 'string', value, at: i });
			i = j + 1;
			continue;
		}
		const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
		if (num) { out.push({ type: 'number', value: Number(num[0]), at: i }); i += num[0].length; continue; }
		const name = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
		if (name) { out.push({ type: 'name', value: name[0], at: i }); i += name[0].length; continue; }
		throw new SyntaxError(`Unexpected character "${ch}" at position ${i}`);
	}
	return out;
}

export function dependencies(node, acc = new Set()) {
	if (node.kind === 'name') acc.add(node.name);
	for (const key of ['left', 'right', 'operand']) {
		if (node[key]) dependencies(node[key], acc);
	}
	return [...acc];
}

export function evaluate(node, ctx) {
	switch (node.kind) {
		case 'or': return evaluate(node.left, ctx) || evaluate(node.right, ctx);
		case 'and': return evaluate(node.left, ctx) && evaluate(node.right, ctx);
		case 'not': return !evaluate(node.operand, ctx);
		case 'cmp': return compare(node, ctx);
		default: return truthy(resolve(node, ctx).value);
	}
}

function resolve(node, ctx) {
	if (node.kind === 'name') return { value: String(ctx.get(node.name) ?? ''), isDate: ctx.typeOf(node.name) === 'date' };
	if (node.kind === 'number') return { value: String(node.value), isDate: false };
	if (node.kind === 'string') return { value: node.value, isDate: false };
	return { value: evaluate(node, ctx) ? 'true' : '', isDate: false };
}

function compare(node, ctx) {
	const l = resolve(node.left, ctx);
	const r = resolve(node.right, ctx);
	if (node.op === '==') return l.value === r.value;
	if (node.op === '!=') return l.value !== r.value;
	let a, b;
	if (l.isDate || r.isDate) {
		a = Date.parse(l.value);
		b = Date.parse(r.value);
	} else {
		a = Number(l.value);
		b = Number(r.value);
		if (l.value.trim() === '' || r.value.trim() === '') return false;
	}
	if (Number.isNaN(a) || Number.isNaN(b)) return false;
	switch (node.op) {
		case '<': return a < b;
		case '<=': return a <= b;
		case '>': return a > b;
		case '>=': return a >= b;
	}
}

function truthy(value) {
	return value !== '';
}

export function compileExpression(src) {
	const node = parseExpression(src);
	return { node, deps: dependencies(node), evaluate: (ctx) => evaluate(node, ctx) };
}
```

- [ ] **Step 5: Run to verify pass** — `npm test`. Expected: all PASS. Also `npm run lint` clean.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: expression engine with shared test vectors"`

### Task 2: Three-state type validators

**Files:**
- Create: `lib/validators.js`, `vectors/validators.json`, `test/unit/validators.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateType(type, value, param) → 'valid'|'incomplete'|'invalid'` (empty value → `'valid'`; emptiness is `required`'s business), `types` registry, `nativeVerdict(validity) → verdict`, `nativeCode(validity) → code|null`, `luhn(digits) → boolean`.

- [ ] **Step 1: Write the failing vector-driven test**

`vectors/validators.json` seed — one valid / one incomplete / one invalid per type; grow while implementing. Format: `{ "type", "value", "param"?, "expected" }`.

```json
[
	{ "type": "alpha", "value": "Jans", "expected": "valid" },
	{ "type": "alpha", "value": "", "expected": "valid" },
	{ "type": "alpha", "value": "Jans7", "expected": "invalid" },
	{ "type": "alphanum", "value": "abc123", "expected": "valid" },
	{ "type": "alphanum", "value": "abc 123", "expected": "invalid" },
	{ "type": "identifier", "value": "field_one-2", "expected": "valid" },
	{ "type": "identifier", "value": "field one", "expected": "invalid" },
	{ "type": "no-whitespace", "value": "a b", "expected": "invalid" },
	{ "type": "email", "value": "jans@websanity.com", "expected": "valid" },
	{ "type": "email", "value": "jans@websanity", "expected": "incomplete" },
	{ "type": "email", "value": "jans@web@x", "expected": "invalid" },
	{ "type": "email-list", "value": "a@b.co, c@d.co", "expected": "valid" },
	{ "type": "email-list", "value": "a@b.co, c@d", "expected": "incomplete" },
	{ "type": "email-list", "value": "a@@b.co, c@d.co", "expected": "invalid" },
	{ "type": "ipv4", "value": "192.168.1.1", "expected": "valid" },
	{ "type": "ipv4", "value": "192.168.", "expected": "incomplete" },
	{ "type": "ipv4", "value": "192.168.1.999", "expected": "invalid" },
	{ "type": "ipv4", "value": "192.168.1-1", "expected": "invalid" },
	{ "type": "ipv6", "value": "2001:db8::1", "expected": "valid" },
	{ "type": "ipv6", "value": "2001:db8:", "expected": "incomplete" },
	{ "type": "ipv6", "value": "2001:zz8::1", "expected": "invalid" },
	{ "type": "ip", "value": "192.168.1.1", "expected": "valid" },
	{ "type": "ip", "value": "2001:db8::1", "expected": "valid" },
	{ "type": "ip", "value": "192.z", "expected": "invalid" },
	{ "type": "credit-card", "value": "4242424242424242", "param": "Visa|MasterCard", "expected": "valid" },
	{ "type": "credit-card", "value": "42424242", "param": "Visa|MasterCard", "expected": "incomplete" },
	{ "type": "credit-card", "value": "4242424242424241", "param": "Visa|MasterCard", "expected": "invalid" },
	{ "type": "credit-card", "value": "378282246310005", "param": "Visa", "expected": "invalid" },
	{ "type": "cvv", "value": "123", "expected": "valid" },
	{ "type": "cvv", "value": "12", "expected": "incomplete" },
	{ "type": "cvv", "value": "12345", "expected": "invalid" },
	{ "type": "us-phone", "value": "(303) 555-1234", "expected": "valid" },
	{ "type": "us-phone", "value": "303555", "expected": "incomplete" },
	{ "type": "us-phone", "value": "303555123456", "expected": "invalid" },
	{ "type": "international-phone", "value": "+44 20 7946 0958", "expected": "valid" },
	{ "type": "international-phone", "value": "+44", "expected": "incomplete" },
	{ "type": "international-phone", "value": "+44x", "expected": "invalid" },
	{ "type": "ssn", "value": "123-45-6789", "expected": "valid" },
	{ "type": "ssn", "value": "123-45", "expected": "incomplete" },
	{ "type": "ssn", "value": "123-456", "expected": "invalid" },
	{ "type": "time", "value": "11:45am", "expected": "valid" },
	{ "type": "time", "value": "11:4", "expected": "incomplete" },
	{ "type": "time", "value": "13:45am", "expected": "invalid" },
	{ "type": "duration", "value": "1:30", "expected": "valid" },
	{ "type": "duration", "value": "1:", "expected": "incomplete" },
	{ "type": "duration", "value": "1:75", "expected": "invalid" },
	{ "type": "us-dollar", "value": "$1,234.56", "expected": "valid" },
	{ "type": "us-dollar", "value": "$1,2", "expected": "incomplete" },
	{ "type": "us-dollar", "value": "$1,2345", "expected": "invalid" },
	{ "type": "zip", "value": "80210", "expected": "valid" },
	{ "type": "zip", "value": "802", "expected": "incomplete" },
	{ "type": "zip", "value": "80210-12345", "expected": "invalid" },
	{ "type": "zip", "value": "8021a", "expected": "invalid" }
]
```

```js
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
```

- [ ] **Step 2: Run to verify failure** — `npm test`. Expected: FAIL (no `lib/validators.js`).

- [ ] **Step 3: Implement `lib/validators.js`**

Regex types use a `full` pattern and a `prefix` pattern (matches values that could still become valid). This table is normative and reappears in `specs/vocabulary.md`:

| Type                  | `full`                                                      | `prefix`                                                |
|-----------------------|-------------------------------------------------------------|---------------------------------------------------------|
| `alpha`               | `/^[A-Za-z]+$/`                                             | `/^[A-Za-z]*$/`                                         |
| `alphanum`            | `/^[A-Za-z0-9]+$/`                                          | `/^[A-Za-z0-9]*$/`                                      |
| `identifier`          | `/^[A-Za-z0-9_-]+$/`                                        | `/^[A-Za-z0-9_-]*$/`                                    |
| `no-whitespace`       | `/^\S+$/`                                                   | `/^\S*$/`                                               |
| `email`               | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`                           | `/^[^\s@]+(@[^\s@]*)?$/`                                |
| `cvv`                 | `/^\d{3,4}$/`                                               | `/^\d{0,4}$/`                                           |
| `us-phone`            | `/^\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}$/`                     | up to 10 digits among chars `()[ .-]` (function)        |
| `international-phone` | `+` then 7–15 digits, separators ` ().-` allowed (function) | same charset, ≤15 digits (function)                     |
| `ssn`                 | `/^\d{3}-\d{2}-\d{4}$/`                                     | `/^\d{0,3}(-\d{0,2}(-\d{0,4})?)?$/`                     |
| `time`                | `/^(1[0-2]\|0?[1-9]):[0-5]\d ?[ap]m$/i`                     | `/^(1[0-2]?\|0?[1-9]?)(:([0-5]\d?)?( ?([ap]m?)?)?)?$/i` |
| `duration`            | `/^\d{1,3}:[0-5]\d$/`                                       | `/^\d{0,3}(:([0-5]\d?)?)?$/`                            |
| `us-dollar`           | `/^\$?(\d+\|\d{1,3}(,\d{3})+)(\.\d{2})?$/`                  | `/^\$?\d{0,3}(,\d{0,3})*(\.\d{0,2})?$/`                 |
| `zip`                 | `/^\d{5}(-\d{4})?$/`                                        | `/^\d{0,5}(-\d{0,4})?$/`                                |

Pipes inside patterns are table-escaped as `\|`; the real regexes use plain `|` alternation.

`ipv4`, `ipv6`, `ip`, `email-list`, and `credit-card` are functions:

```js
export function validateType(type, value, param) {
	if (value === '') return 'valid';
	const def = types[type];
	if (!def) throw new Error(`Unknown data-fs-type "${type}"`);
	if (typeof def === 'function') return def(value, param);
	if (def.full.test(value)) return 'valid';
	return def.prefix.test(value) ? 'incomplete' : 'invalid';
}

export function luhn(digits) {
	let sum = 0;
	let double = false;
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		let d = Number(digits[i]);
		if (double) { d *= 2; if (d > 9) d -= 9; }
		sum += d;
		double = !double;
	}
	return sum % 10 === 0;
}

function ipv4(value) {
	if (!/^[\d.]+$/.test(value)) return 'invalid';
	const parts = value.split('.');
	if (parts.length > 4) return 'invalid';
	for (const p of parts.slice(0, -1)) {
		if (p === '' || p.length > 3 || Number(p) > 255) return 'invalid';
	}
	const last = parts[parts.length - 1];
	if (last.length > 3 || (last !== '' && Number(last) > 255)) return 'invalid';
	return parts.length === 4 && last !== '' ? 'valid' : 'incomplete';
}

function ipv6(value) {
	if (!/^[0-9A-Fa-f:]+$/.test(value)) return 'invalid';
	if ((value.match(/::/g) ?? []).length > 1) return 'invalid';
	const groups = value.replace('::', ':x:').split(':').filter((g) => g !== '');
	if (groups.some((g) => g !== 'x' && g.length > 4)) return 'invalid';
	const count = groups.filter((g) => g !== 'x').length;
	if (count > 8) return 'invalid';
	const complete = value.includes('::') ? count <= 7 : count === 8;
	if (complete && !value.endsWith(':')) return 'valid';
	return 'incomplete';
}

const RANK = { invalid: 0, incomplete: 1, valid: 2 };

function ip(value) {
	const a = ipv4(value);
	const b = ipv6(value);
	return RANK[a] >= RANK[b] ? a : b;
}

function emailList(value) {
	const items = value.split(/[\s,]+/).filter((s) => s !== '');
	let worst = 'valid';
	items.forEach((item, i) => {
		let v = validateType('email', item);
		if (v === 'incomplete' && i < items.length - 1) v = 'invalid';
		if (RANK[v] < RANK[worst]) worst = v;
	});
	return worst;
}

const NETWORKS = {
	Visa: { iin: /^4/, lengths: [13, 16, 19] },
	MasterCard: { iin: /^(5[1-5]|2[2-7])/, lengths: [16] },
	Amex: { iin: /^3[47]/, lengths: [15] },
	Discover: { iin: /^6(011|5)/, lengths: [16, 17, 18, 19] }
};

function creditCard(value, param = 'Visa|MasterCard|Amex|Discover') {
	const digits = value.replace(/[ -]/g, '');
	if (!/^\d*$/.test(digits)) return 'invalid';
	const allowed = param.split('|').map((n) => NETWORKS[n]).filter(Boolean);
	const candidates = allowed.filter((n) => n.iin.test(digits) || digits.length < 2);
	if (candidates.length === 0) return 'invalid';
	const maxLen = Math.max(...candidates.flatMap((n) => n.lengths));
	if (digits.length > maxLen) return 'invalid';
	const done = candidates.some((n) => n.lengths.includes(digits.length));
	if (!done) return 'incomplete';
	return luhn(digits) ? 'valid' : digits.length === maxLen ? 'invalid' : 'incomplete';
}
```

Phone functions: strip the separator charset; a stripped `us-phone` is `invalid` on any char outside `\d()[ .-]` or more than 10 digits, `valid` on exactly 10 digits matching the full pattern shape, else `incomplete`. `international-phone` requires leading `+`, then digits with separators; over 15 digits or a foreign char is `invalid`; 7–15 digits is `valid`; fewer is `incomplete`.

Assemble `types` from the regex table plus `{ ipv4, ipv6, ip, 'email-list': emailList, 'credit-card': creditCard, 'us-phone': usPhone, 'international-phone': internationalPhone }`, and:

```js
export function nativeVerdict(v) {
	if (v.valid) return 'valid';
	if (v.badInput || v.rangeOverflow || v.stepMismatch || v.tooLong) return 'invalid';
	return 'incomplete';
}

const NATIVE_CODES = [
	['valueMissing', 'required'], ['badInput', 'badinput'], ['typeMismatch', 'type.native'],
	['patternMismatch', 'pattern'], ['tooShort', 'minlength'], ['tooLong', 'maxlength'],
	['rangeUnderflow', 'min'], ['rangeOverflow', 'max'], ['stepMismatch', 'step']
];

export function nativeCode(v) {
	if (v.valid) return null;
	for (const [flag, code] of NATIVE_CODES) {
		if (v[flag]) return code;
	}
	return null;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test`, then top up `vectors/validators.json` to at least six vectors per type (cover each prefix-pattern edge you wrote) and re-run.

- [ ] **Step 5: Commit** — `git commit -am "feat: three-state type validators with shared vectors"`

### Task 3: Message catalog

**Files:**
- Create: `lib/messages.js`, `test/unit/messages.test.js`

**Interfaces:**
- Consumes: codes from the shared reference table.
- Produces: `messageFor(code, params = {}) → string`, `catalog` (mutable export so sites and tests can replace strings), `formMessages` (status-region strings).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify failure** — `npm test`.

- [ ] **Step 3: Implement `lib/messages.js`** — the full catalog (wording modeled on v1's `ERROR_MSGS`, typos fixed):

```js
export const catalog = {
	'required': 'required',
	'type.alpha': 'letters only',
	'type.alphanum': 'letters/numbers only',
	'type.identifier': 'letters, numbers, underscores, or dashes only',
	'type.no-whitespace': 'no whitespace characters',
	'type.email': 'must be an email address',
	'type.email-list': 'must be a list of email addresses',
	'type.ipv4': 'IPv4 address, example: 192.168.1.1',
	'type.ipv6': 'IPv6 address, example: 2001:db8:85a3:8d3:1319:8a2e:370:7348',
	'type.ip': 'either an IPv4 or IPv6 address',
	'type.credit-card': 'must be {networks}',
	'type.cvv': '3 or 4 digit number',
	'type.us-phone': '(###) ###-####',
	'type.international-phone': 'international phone number, example: +44 20 7946 0958',
	'type.ssn': '###-##-####',
	'type.time': 'example: 11:45am',
	'type.duration': 'HH:MM',
	'type.us-dollar': 'must be a dollar value',
	'type.zip': '##### or #####-####',
	'type.native': 'not valid',
	'badinput': 'must be a number',
	'pattern': 'must match the required format',
	'minlength': 'minimum of {n} characters',
	'maxlength': 'maximum of {n} characters',
	'min': 'minimum of {n}',
	'max': 'maximum of {n}',
	'step': 'must be a whole number',
	'equals': 'must be equal to {value}',
	'not-equals': 'must be a different answer',
	'equals-field': 'must be equal to {label}',
	'not-equals-field': 'must be different from {label}',
	'greater-than-field': 'must be greater than {label}',
	'greater-than-field.date': 'must be after {label}',
	'less-than-field': 'must be less than {label}',
	'less-than-field.date': 'must be before {label}',
	'min-digits': 'minimum of {n} digit characters',
	'min-uppercase': 'minimum of {n} uppercase characters',
	'min-lowercase': 'minimum of {n} lowercase characters',
	'group.at-least-one': 'one or more required',
	'group.all-or-none': 'all (or none) required',
	'min-selected': 'select at least {n}',
	'max-selected': 'select at most {n}',
	'file.max-size': 'file must be {size} or smaller',
	'unique': 'already in use',
	'unique-in-page': 'must be unique'
};

export const formMessages = {
	incomplete: 'Please complete the required fields marked *',
	invalid: 'Please fix the highlighted fields',
	processing: 'Processing…',
	error: 'Something went wrong. Please try again.',
	protocol: 'Unexpected response from the server.'
};

export function messageFor(code, params = {}) {
	const template = catalog[code] ?? 'not valid';
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}
```

- [ ] **Step 4: Run to verify pass** — `npm test`.

- [ ] **Step 5: Commit** — `git commit -am "feat: default message catalog"`

### Task 4: Reference dev server

**Files:**
- Create: `test/server.js`, `test/unit/server.test.js`

**Interfaces:**
- Consumes: nothing (bare `node:http`).
- Produces: `createServer() → http.Server` (exported for tests; `node test/server.js` listens on `process.env.PORT ?? 8347`). Routes: `POST /api/submit` (accepts; echoes `message` "Thanks!"), `POST /api/submit?scenario=invalid` (422; rejects every field named in the `reject` form value — comma-separated `name:code` pairs), `POST /api/submit?scenario=redirect` (accepted with `redirect`), `POST /api/submit?scenario=error` (500), `POST /api/unique` (unique unless value is `taken@example.com` or `taken`; every third call within 2s returns 429), `GET /*` static files from the repo root with correct `Content-Type` for html/css/js/json.

- [ ] **Step 1: Write the failing test** — start the server on an ephemeral port, `fetch` each route, assert envelope shapes:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

let server;
let base;

before(async () => {
	server = createServer();
	await new Promise((resolve) => server.listen(0, resolve));
	base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('accepts a JSON submission', async () => {
	const res = await fetch(`${base}/api/submit`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'a@b.co' })
	});
	assert.equal(res.status, 200);
	const data = await res.json();
	assert.equal(data.formsanity, 2);
	assert.equal(data.status, 'accepted');
});

test('rejects with per-field errors', async () => {
	const res = await fetch(`${base}/api/submit?scenario=invalid`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'a@b.co', reject: 'email:unique' })
	});
	assert.equal(res.status, 422);
	const data = await res.json();
	assert.equal(data.status, 'invalid');
	assert.deepEqual(data.errors[0], { field: 'email', code: 'unique', message: 'already in use' });
});

test('redirect scenario', async () => {
	const res = await fetch(`${base}/api/submit?scenario=redirect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	const data = await res.json();
	assert.equal(data.status, 'accepted');
	assert.equal(data.redirect, '/instrumentation/submitted.html');
});

test('error scenario', async () => {
	const res = await fetch(`${base}/api/submit?scenario=error`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
	assert.equal(res.status, 500);
	assert.equal((await res.json()).status, 'error');
});

test('unique endpoint', async () => {
	const res = await fetch(`${base}/api/unique`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'email', value: 'taken@example.com' }) });
	const data = await res.json();
	assert.equal(data.formsanity, 2);
	assert.equal(data.unique, false);
});

test('serves static files', async () => {
	const res = await fetch(`${base}/lib/expression.js`);
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type'), /javascript/);
});
```

- [ ] **Step 2: Run to verify failure** — `npm test`.

- [ ] **Step 3: Implement `test/server.js`** — `node:http` + `node:fs`. Parse JSON bodies and multipart bodies (for multipart, only field extraction by boundary split is needed — store filenames, discard file bytes). Envelope helpers:

```js
function send(res, status, payload) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ formsanity: 2, ...payload }));
}
```

Accepted: `send(res, 200, { status: 'accepted', message: 'Thanks!' })`. Invalid: build `errors` from the `reject` value (`name:code` pairs, message from a tiny inline map matching `lib/messages.js` wording). Redirect: `send(res, 200, { status: 'accepted', redirect: '/instrumentation/submitted.html' })`. Error: `send(res, 500, { status: 'error', message: 'Could not store submission' })`. Unique: rate-limit bookkeeping in a module-level counter; on limit `res.writeHead(429)` with empty body. Static: resolve against repo root, forbid `..`, map extensions `.html/.css/.js/.mjs/.json/.svg/.webp`.

- [ ] **Step 4: Run to verify pass** — `npm test`.

- [ ] **Step 5: Commit** — `git commit -am "feat: reference dev server implementing the submission protocol"`

### Task 5: Playwright harness + first page + engine skeleton

**Files:**
- Create: `playwright.config.js`, `instrumentation/index.html`, `instrumentation/instrumentation.css`, `instrumentation/submitted.html`, `lib/formsanity.js`, `lib/parse.js` (skeleton), `test/e2e/smoke.spec.js`

**Interfaces:**
- Consumes: dev server from Task 4.
- Produces: `init(root = document) → controllers[]` in `lib/formsanity.js`; `parseForm(formEl) → model` where `model = { form, fields: Map, groups: [], unique: [] }` and each field is `{ name, controls, row, label, type, rules, relevance }`; the instrumentation page pattern all later pages copy.

- [ ] **Step 1: Write `playwright.config.js`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'test/e2e',
	use: { baseURL: 'http://localhost:8347' },
	webServer: { command: 'node test/server.js', port: 8347, reuseExistingServer: true },
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
```

Run `npx playwright install chromium`.

- [ ] **Step 2: Write the failing smoke spec**

```js
import { test, expect } from '@playwright/test';

test('index page initializes FormSanity', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const form = page.locator('form[data-fs-form]');
	await expect(form).toHaveAttribute('novalidate', '');
	await expect(form).toHaveClass(/fs-form/);
});
```

Run `npm run test:e2e` — FAIL (no page).

- [ ] **Step 3: Build `instrumentation/index.html`** — invoke the `writing-html-css` skill first. Structure (this is the canonical page pattern; keep it):

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Required :: FormSanity Instrumentation</title>
	<link rel="stylesheet" href="../lib/formsanity.css">
	<link rel="stylesheet" href="instrumentation.css">
	<script type="module">
		import { init } from '../lib/formsanity.js';
		init();
	</script>
</head>
<body>
	<header>
		<h1>FormSanity Instrumentation</h1>
		<nav>
			<ul>
				<li><a href="index.html" aria-current="page">Required</a></li>
				<li><a href="types.html">Types</a></li>
				<li><a href="limits.html">Limits</a></li>
				<li><a href="comparisons.html">Comparisons</a></li>
				<li><a href="relevance.html">Relevance</a></li>
				<li><a href="operations.html">Operations</a></li>
				<li><a href="choice-groups.html">Choice Groups</a></li>
				<li><a href="submission.html">Submission</a></li>
			</ul>
		</nav>
	</header>
	<main>
		<form data-fs-form action="/api/submit" method="post">
			<fieldset>
				<legend>Required Fields</legend>
				<ul>
					<li>
						<label for="full-name">Name</label>
						<input id="full-name" name="full-name" type="text" required>
					</li>
					<li>
						<label for="email">Email</label>
						<input id="email" name="email" type="email" required>
						<small>We never share it.</small>
					</li>
					<li>
						<label for="nickname">Nickname</label>
						<input id="nickname" name="nickname" type="text">
					</li>
				</ul>
			</fieldset>
			<button type="submit">Submit</button>
		</form>
	</main>
</body>
</html>
```

`instrumentation.css` is page chrome only (header, nav) — the form must look right with `formsanity.css` alone. Create an empty `lib/formsanity.css` containing just `@layer formsanity;` for now (Task 15 fills it). `instrumentation/submitted.html` is a minimal "Submitted." page used as a redirect target.

- [ ] **Step 4: Implement the engine skeleton** — `lib/formsanity.js`:

```js
import { parseForm } from './parse.js';

export function init(root = document) {
	return [...root.querySelectorAll('form[data-fs-form]')].map(setup);
}

function setup(form) {
	form.setAttribute('novalidate', '');
	form.classList.add('fs-form');
	const model = parseForm(form);
	form.dispatchEvent(new CustomEvent('fs:init', { bubbles: true, detail: { model } }));
	return { form, model };
}
```

`lib/parse.js` skeleton — the full rule extraction lands across Tasks 6–9, but the model shape is fixed now:

```js
const ROW_SELECTOR = 'li, [data-fs-field], .block';

export function parseForm(form) {
	const model = { form, fields: new Map(), groups: [], unique: [] };
	for (const control of form.querySelectorAll('input[name], select[name], textarea[name]')) {
		const name = control.name;
		if (model.fields.has(name)) {
			model.fields.get(name).controls.push(control);
			continue;
		}
		model.fields.set(name, {
			name,
			controls: [control],
			row: control.closest(ROW_SELECTOR),
			label: labelFor(control),
			type: control.getAttribute('data-fs-type'),
			errorTo: control.getAttribute('data-fs-error-to'),
			rules: [],
			relevance: null
		});
	}
	return model;
}

function labelFor(control) {
	const explicit = control.getAttribute('data-fs-label');
	if (explicit) return explicit;
	const row = control.closest(ROW_SELECTOR);
	const label = (control.id && control.closest('form').querySelector(`label[for="${control.id}"]`)) || row?.querySelector('label');
	return label ? label.textContent.trim() : control.name;
}
```

- [ ] **Step 5: Run to verify pass** — `npm run test:e2e` green; `npm test` still green; lint clean.

- [ ] **Step 6: Commit** — `git commit -am "feat: playwright harness, first instrumentation page, engine skeleton"`

### Task 6: Field state, error presenter, timing (native rules)

**Files:**
- Create: `lib/fields.js`, `lib/errors.js`, `test/e2e/timing.spec.js`
- Modify: `lib/formsanity.js`

**Interfaces:**
- Consumes: `parseForm`, `nativeVerdict`, `nativeCode`, `validateType`, `messageFor`.
- Produces: `createFieldController(field, ctx) → { field, verdict, code, params, refresh(), present() }` in `lib/fields.js` — `ctx = { model, valueOf(name), typeOf(name), onChange(fieldName) }`; `refresh()` recomputes verdict and applies timing; row classes `fs-valid` / `fs-incomplete` / `fs-invalid`. In `lib/errors.js`: `showBubble(field, message)`, `clearBubble(field)`, `applyRowState(field, verdict, shown)`, `ensureStatusRegion(form) → element` (empty container for now; Task 11 populates it). `showBubble` honors `data-fs-error-to`: when the field has `field.errorTo` (a selector string, read by `parseForm` from `data-fs-error-to`), the bubble renders inside `form.querySelector(field.errorTo)` instead of the row. On every verdict change, `refresh()` dispatches `fs:field-valid` or `fs:field-invalid` on the field's first control (bubbling, `detail: { name, verdict, code }`).

- [ ] **Step 1: Write the failing e2e spec** — timing behaviors on `index.html` plus a temporary `type="number"` field added to the page (`<li><label for="age">Age</label><input id="age" name="age" type="number" min="18" max="120" step="1"></li>`):

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/instrumentation/index.html');
});

test('incomplete defers to blur, then clears live', async ({ page }) => {
	const email = page.locator('#email');
	await email.fill('jans@websanity');
	await expect(page.locator('#email ~ .fs-error, [id="email"] + .fs-error')).toHaveCount(0);
	await email.blur();
	const row = page.locator('li:has(#email)');
	await expect(row).toHaveClass(/fs-incomplete|fs-invalid/);
	await expect(row.locator('.fs-error')).toBeVisible();
	await email.fill('jans@websanity.com');
	await expect(row.locator('.fs-error')).toHaveCount(0);
	await expect(row).toHaveClass(/fs-valid/);
});

test('dead-end presents immediately on input', async ({ page }) => {
	const age = page.locator('#age');
	await age.pressSequentially('200');
	const row = page.locator('li:has(#age)');
	await expect(row).toHaveClass(/fs-invalid/);
	await expect(row.locator('.fs-error')).toContainText('maximum of 120');
});

test('required empty is incomplete (asterisk state), not an error bubble', async ({ page }) => {
	const row = page.locator('li:has(#full-name)');
	await expect(row).toHaveClass(/fs-incomplete/);
	await expect(row.locator('.fs-error')).toHaveCount(0);
});

test('error message is wired for assistive tech', async ({ page }) => {
	const email = page.locator('#email');
	await email.fill('nope@');
	await email.blur();
	await expect(email).toHaveAttribute('aria-invalid', 'true');
	const described = await email.getAttribute('aria-describedby');
	await expect(page.locator(`#${described}`)).toContainText('email');
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:e2e`.

- [ ] **Step 3: Implement**

`lib/errors.js`:

```js
let bubbleSeq = 0;

export function showBubble(field, message) {
	const control = field.controls[0];
	let bubble = field.row?.querySelector('.fs-error');
	if (!bubble) {
		bubble = document.createElement('p');
		bubble.className = 'fs-error';
		bubble.id = `fs-error-${bubbleSeq += 1}`;
		(field.row ?? control.parentElement).append(bubble);
	}
	bubble.textContent = message;
	control.setAttribute('aria-invalid', 'true');
	control.setAttribute('aria-describedby', bubble.id);
}

export function clearBubble(field) {
	field.row?.querySelector('.fs-error')?.remove();
	for (const control of field.controls) {
		control.removeAttribute('aria-invalid');
		control.removeAttribute('aria-describedby');
	}
}

export function applyRowState(field, verdict) {
	const row = field.row;
	if (!row) return;
	row.classList.toggle('fs-valid', verdict === 'valid');
	row.classList.toggle('fs-incomplete', verdict === 'incomplete');
	row.classList.toggle('fs-invalid', verdict === 'invalid');
}

export function ensureStatusRegion(form) {
	let region = form.querySelector('.fs-status');
	if (!region) {
		region = document.createElement('div');
		region.className = 'fs-status';
		region.setAttribute('aria-live', 'polite');
		const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
		(submit ?? form.lastElementChild).before(region);
	}
	return region;
}
```

`lib/fields.js` — verdict merge order: native `ValidityState` first, then `data-fs-type`, then fs rules (rules arrive in Tasks 7–9 via `field.rules`; the controller already iterates them):

```js
import { nativeVerdict, nativeCode, validateType } from './validators.js';
import { messageFor } from './messages.js';
import { showBubble, clearBubble, applyRowState } from './errors.js';
import { checkRule } from './rules.js';

const RANK = { invalid: 0, incomplete: 1, valid: 2 };

export function createFieldController(field, ctx) {
	const state = { shown: false };
	const controller = { field, verdict: 'valid', code: null, params: {}, refresh, present };

	function compute() {
		const control = field.controls[0];
		let verdict = 'valid';
		let code = null;
		let params = {};
		const nv = nativeVerdict(control.validity);
		if (nv !== 'valid') {
			verdict = nv;
			code = nativeCode(control.validity);
			params = { n: control.getAttribute(code === 'minlength' ? 'minlength' : code === 'maxlength' ? 'maxlength' : code) ?? '' };
		}
		if (verdict !== 'invalid' && field.type && control.value !== '') {
			const tv = validateType(field.type, control.value, field.typeParam);
			if (RANK[tv] < RANK[verdict]) { verdict = tv; code = `type.${field.type}`; params = { networks: field.typeParam?.replace(/\|/g, ', ') ?? '' }; }
		}
		for (const rule of field.rules) {
			const r = checkRule(rule, field, ctx);
			if (r && RANK[r.verdict] < RANK[verdict]) { verdict = r.verdict; code = r.code; params = r.params; }
		}
		return { verdict, code, params };
	}

	function refresh(trigger) {
		const { verdict, code, params } = compute();
		controller.verdict = verdict;
		controller.code = code;
		controller.params = params;
		applyRowState(field, verdict);
		const isErrorWorthy = verdict === 'invalid' || (verdict === 'incomplete' && code !== 'required');
		if (verdict === 'valid' || (code === 'required' && !state.shown)) {
			clearBubble(field);
			if (verdict === 'valid') state.shown = false;
		} else if (verdict === 'invalid' || state.shown || (trigger === 'blur' && isErrorWorthy)) {
			present();
		}
		ctx.onChange(field.name);
	}

	function present() {
		state.shown = true;
		showBubble(field, messageFor(controller.code, controller.params));
	}

	return controller;
}
```

Create `lib/rules.js` now with just the export so `fields.js` imports cleanly (rule kinds land in Tasks 7–9):

```js
export function checkRule(_rule, _field, _ctx) {
	return null;
}
```

Wire in `lib/formsanity.js` `setup()`: build controllers for every field; delegate `input` and `blur` (capture `focusout`) listeners on the form; on `input` refresh the controller owning the target (`trigger: 'input'`), on `focusout` with `trigger: 'blur'`; `ctx.valueOf(name)` returns the field's value (checked radios/checkboxes: the checked values joined by `,`; selects: `value`), `ctx.typeOf(name)` returns `'date'` for `type="date"` controls else `field.type`; `ctx.onChange` is a no-op until Task 10.

- [ ] **Step 4: Run to verify pass** — `npm run test:e2e`; `npm test`.

- [ ] **Step 5: Commit** — `git commit -am "feat: field state, error presenter, three-state timing"`

### Task 7: data-fs-type wiring + types instrumentation page

**Files:**
- Create: `instrumentation/types.html`, `test/e2e/types.spec.js`
- Modify: `lib/parse.js`

**Interfaces:**
- Consumes: `validateType` (already merged by `fields.js`).
- Produces: `field.type` and `field.typeParam` populated by `parseForm` — `data-fs-type="credit-card"` with `data-fs-type-param="Visa|MasterCard"` (the network list moves out of v1's `credit-card:Visa|...` colon syntax into its own attribute).

- [ ] **Step 1: Write the failing spec** — `types.html` gets one row per `data-fs-type` (copy the roster from `vectors/validators.json`; every type appears exactly once). Spec drives three representative types end-to-end:

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/types.html'); });

test('zip dead-end flags immediately', async ({ page }) => {
	await page.locator('#zip').pressSequentially('80a');
	await expect(page.locator('li:has(#zip)')).toHaveClass(/fs-invalid/);
});

test('zip incomplete waits for blur', async ({ page }) => {
	await page.locator('#zip').pressSequentially('802');
	await expect(page.locator('li:has(#zip) .fs-error')).toHaveCount(0);
	await page.locator('#zip').blur();
	await expect(page.locator('li:has(#zip) .fs-error')).toContainText('#####');
});

test('credit-card respects the network param', async ({ page }) => {
	await page.locator('#card').fill('378282246310005');
	await page.locator('#card').blur();
	await expect(page.locator('li:has(#card) .fs-error')).toContainText('Visa');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Build the page and parser support** — page follows the Task 5 pattern (invoke `writing-html-css` first); parser reads `data-fs-type` (already) plus `field.typeParam = control.getAttribute('data-fs-type-param')`. Card row: `<input id="card" name="card" type="text" data-fs-type="credit-card" data-fs-type-param="Visa|MasterCard">`. Include native-type rows too (`type="email"`, `type="url"`, `type="date"`, `type="number" min max step`) so the page documents the native register.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -am "feat: data-fs-type wiring and types instrumentation page"`

### Task 8: Cross-field rules, password composition, files + limits/comparisons pages

**Files:**
- Create: `instrumentation/limits.html`, `instrumentation/comparisons.html`, `test/e2e/rules.spec.js`
- Modify: `lib/parse.js`, `lib/rules.js`

**Interfaces:**
- Consumes: `ctx.valueOf`, `ctx.typeOf`, `messageFor`.
- Produces: `field.rules` entries `{ kind, param }` for kinds `equals`, `not-equals`, `equals-field`, `not-equals-field`, `greater-than-field`, `less-than-field`, `min-digits`, `min-uppercase`, `min-lowercase`, `max-file-size`; `checkRule(rule, field, ctx) → { verdict, code, params } | null`; `parseSize('2MB') → bytes` exported from `lib/rules.js`.

- [ ] **Step 1: Write the failing spec** — key cases:

```js
import { test, expect } from '@playwright/test';

test('confirm mismatch is a dead end when not a prefix', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hx');
	await expect(page.locator('li:has(#confirm)')).toHaveClass(/fs-invalid/);
});

test('confirm prefix stays quiet until blur', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#password').fill('hunter22');
	await page.locator('#confirm').pressSequentially('hun');
	await expect(page.locator('li:has(#confirm) .fs-error')).toHaveCount(0);
});

test('date comparison is chronological with date wording', async ({ page }) => {
	await page.goto('/instrumentation/comparisons.html');
	await page.locator('#start').fill('2026-09-01');
	await page.locator('#end').fill('2026-08-01');
	await page.locator('#end').blur();
	await expect(page.locator('li:has(#end) .fs-error')).toContainText('after');
});

test('password composition counts character classes', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#new-password').fill('alllowercase1');
	await page.locator('#new-password').blur();
	await expect(page.locator('li:has(#new-password) .fs-error')).toContainText('uppercase');
});

test('file size cap', async ({ page }) => {
	await page.goto('/instrumentation/limits.html');
	await page.locator('#attachment').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3 * 1024 * 1024) });
	await expect(page.locator('li:has(#attachment)')).toHaveClass(/fs-invalid/);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — parser maps attributes to rules:

| Attribute                                                | Rule kind                                               |
|----------------------------------------------------------|---------------------------------------------------------|
| `data-fs-equals` / `data-fs-not-equals`                  | `equals` / `not-equals` (param: literal)                |
| `data-fs-equals-field` / `data-fs-not-equals-field`      | `equals-field` / `not-equals-field` (param: field name) |
| `data-fs-greater-than-field` / `data-fs-less-than-field` | `greater-than-field` / `less-than-field`                |
| `data-fs-min-digits` / `-uppercase` / `-lowercase`       | `min-digits` etc. (param: count)                        |
| `data-fs-max-file-size`                                  | `max-file-size` (param: size string)                    |

`checkRule` in `lib/rules.js` (replacing the stub):

```js
export function checkRule(rule, field, ctx) {
	const value = ctx.valueOf(field.name);
	switch (rule.kind) {
		case 'equals':
		case 'equals-field': {
			const target = rule.kind === 'equals' ? rule.param : ctx.valueOf(rule.param);
			if (value === target) return null;
			if (value === '') return null;
			const verdict = target.startsWith(value) ? 'incomplete' : 'invalid';
			const params = rule.kind === 'equals' ? { value: rule.param } : { label: ctx.labelOf(rule.param) };
			return { verdict, code: rule.kind, params };
		}
		case 'not-equals':
		case 'not-equals-field': {
			const target = rule.kind === 'not-equals' ? rule.param : ctx.valueOf(rule.param);
			if (value === '' || value !== target) return null;
			return { verdict: 'incomplete', code: rule.kind, params: { label: rule.kind === 'not-equals-field' ? ctx.labelOf(rule.param) : '' } };
		}
		case 'greater-than-field':
		case 'less-than-field': {
			const other = ctx.valueOf(rule.param);
			if (value === '' || other === '') return null;
			const dates = ctx.typeOf(field.name) === 'date' || ctx.typeOf(rule.param) === 'date';
			const [a, b] = dates ? [Date.parse(value), Date.parse(other)] : [Number(value), Number(other)];
			if (Number.isNaN(a) || Number.isNaN(b)) return null;
			const ok = rule.kind === 'greater-than-field' ? a > b : a < b;
			if (ok) return null;
			const code = dates ? `${rule.kind}.date` : rule.kind;
			return { verdict: 'incomplete', code, params: { label: ctx.labelOf(rule.param) } };
		}
		case 'min-digits':
		case 'min-uppercase':
		case 'min-lowercase': {
			if (value === '') return null;
			const classes = { 'min-digits': /\d/g, 'min-uppercase': /[A-Z]/g, 'min-lowercase': /[a-z]/g };
			const count = (value.match(classes[rule.kind]) ?? []).length;
			if (count >= Number(rule.param)) return null;
			return { verdict: 'incomplete', code: rule.kind, params: { n: rule.param } };
		}
		case 'max-file-size': {
			const file = field.controls[0].files?.[0];
			if (!file || file.size <= parseSize(rule.param)) return null;
			return { verdict: 'invalid', code: 'file.max-size', params: { size: rule.param } };
		}
		default:
			return null;
	}
}

const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

export function parseSize(text) {
	const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(text.trim());
	if (!m) throw new Error(`Bad size "${text}" — use forms like "500KB" or "2MB"`);
	return Number(m[1]) * UNITS[m[2].toLowerCase()];
}
```

Add `ctx.labelOf(name)` (returns `model.fields.get(name)?.label ?? name`) in `formsanity.js`. Cross-field rules also refresh their dependents: when field X changes, refresh any controller whose rules reference X (build a reverse map at setup). `limits.html` covers minlength/maxlength/min/max/step, composition, `accept` + `data-fs-max-file-size="2MB"`; `comparisons.html` covers all six comparison attributes including a date pair. Add unit tests for `parseSize` in `test/unit/rules.test.js` (valid units, case-insensitivity, rejects `"2 gigs"`).

- [ ] **Step 4: Run to verify pass** — e2e + unit + lint.

- [ ] **Step 5: Commit** — `git commit -am "feat: cross-field rules, password composition, file size cap"`

### Task 9: Groups + choice-groups page

**Files:**
- Create: `instrumentation/choice-groups.html`, `test/e2e/groups.spec.js`
- Modify: `lib/parse.js`, `lib/rules.js`, `lib/fields.js`

**Interfaces:**
- Consumes: field controllers, row states.
- Produces: `model.groups` entries `{ kind: 'at-least-one'|'all-or-none', name, members: string[] }` from `data-fs-group-at-least-one` / `data-fs-group-all-or-none`; rules `min-selected` / `max-selected` (on any control of a checkbox set, param: count) and `unique-in-page` (param: group name); group verdicts land on every member row.

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/choice-groups.html'); });

test('at-least-one satisfied by any member', async ({ page }) => {
	const rows = page.locator('li:has([data-fs-group-at-least-one="contact"])');
	await expect(rows.first()).toHaveClass(/fs-incomplete/);
	await page.locator('#contact-phone').fill('(303) 555-1234');
	await expect(rows.first()).toHaveClass(/fs-valid/);
});

test('max-selected is immediate', async ({ page }) => {
	const boxes = page.locator('input[name="toppings"]');
	await boxes.nth(0).check();
	await boxes.nth(1).check();
	await boxes.nth(2).check();
	await expect(page.locator('fieldset:has(input[name="toppings"]) .fs-error')).toContainText('at most 2');
});

test('unique-in-page', async ({ page }) => {
	await page.locator('#ref-one').fill('same@x.co');
	await page.locator('#ref-two').fill('same@x.co');
	await page.locator('#ref-two').blur();
	await expect(page.locator('li:has(#ref-two) .fs-error')).toContainText('unique');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — parser collects groups from member attributes; group evaluation lives in `lib/rules.js` as `checkGroups(model, ctx) → Map<fieldName, {verdict, code, params}>` called during any member's refresh: `at-least-one` yields `incomplete`/`group.at-least-one` on all members while none has a value; `all-or-none` yields `incomplete`/`group.all-or-none` on empty members while at least one member has a value. Checkbox sets: selected count under `min-selected` → `incomplete`; over `max-selected` → `invalid` (present immediately; the bubble attaches to the set's `fieldset`, so give `showBubble` a fallback: when `field.row` is null use `control.closest('fieldset')`). `unique-in-page`: on blur, a value equal to another member's value → `invalid`. Page: a contact-method trio (`data-fs-group-at-least-one="contact"`), a spouse-name pair (`all-or-none`), a toppings checkbox `fieldset.toggle-list` with `data-fs-min-selected="1" data-fs-max-selected="2"`, a `toggle-list buttons` radio set, and two reference-email fields sharing `data-fs-unique-in-page="refs"`. Choice-group grammar per the design: `fieldset` + `legend` + `ul` of `li > label > input` rows.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -am "feat: group rules and choice-groups instrumentation page"`

### Task 10: Relevance engine + relevance page

**Files:**
- Create: `lib/relevance.js`, `instrumentation/relevance.html`, `test/e2e/relevance.spec.js`
- Modify: `lib/parse.js`, `lib/formsanity.js`

**Interfaces:**
- Consumes: `compileExpression`, field controllers, `ctx.valueOf` / `ctx.typeOf`.
- Produces: `createRelevanceEngine(model, ctx) → { refresh(changedName?), isRelevant(name) }`. Parser fills `field.relevance = { expr, deps, mode }` from `data-fs-relevant` (+ `data-fs-irrelevant`, default `hidden`). Irrelevant application: row gets `hidden` + class `fs-irrelevant` and controls get `disabled` (mode `hidden`), or controls get `disabled` only (mode `disabled`); irrelevant fields are skipped in validation, gating, and gathering (`isRelevant` is consulted everywhere).

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/relevance.html'); });

test('hidden until relevant, then validated', async ({ page }) => {
	const row = page.locator('li:has(#other-color)');
	await expect(row).toBeHidden();
	await page.locator('#color').selectOption('Other');
	await expect(row).toBeVisible();
	await expect(row).toHaveClass(/fs-incomplete/);
});

test('disabled mode disables instead of hiding', async ({ page }) => {
	await expect(page.locator('#shipping-notes')).toBeDisabled();
	await page.locator('#ship').check();
	await expect(page.locator('#shipping-notes')).toBeEnabled();
});

test('irrelevant fields do not gate or submit', async ({ page }) => {
	await page.locator('#color').selectOption('Red');
	const posted = page.waitForRequest('**/api/submit');
	await page.locator('button[type="submit"]').click();
	const body = (await posted).postDataJSON();
	expect(body['other-color']).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `lib/relevance.js`**

```js
import { compileExpression } from './expression.js';

export function createRelevanceEngine(model, ctx) {
	const compiled = new Map();
	const dependents = new Map();
	for (const field of model.fields.values()) {
		if (!field.relevance) continue;
		const c = compileExpression(field.relevance.expr);
		compiled.set(field.name, c);
		for (const dep of c.deps) {
			if (!dependents.has(dep)) dependents.set(dep, new Set());
			dependents.get(dep).add(field.name);
		}
	}
	const relevant = new Map();

	function apply(field, isRelevant) {
		relevant.set(field.name, isRelevant);
		const mode = field.relevance.mode;
		if (mode === 'hidden' && field.row) {
			field.row.hidden = !isRelevant;
			field.row.classList.toggle('fs-irrelevant', !isRelevant);
		}
		for (const control of field.controls) control.disabled = !isRelevant;
	}

	function refresh(changedName) {
		const names = changedName ? dependents.get(changedName) ?? [] : compiled.keys();
		for (const name of names) {
			const field = model.fields.get(name);
			apply(field, compiled.get(name).evaluate({ get: ctx.valueOf, typeOf: ctx.typeOf }));
			ctx.onChange(name);
		}
	}

	refresh();
	return { refresh, isRelevant: (name) => relevant.get(name) ?? true };
}
```

Parser: `data-fs-relevant` → `{ expr, mode: control.getAttribute('data-fs-irrelevant') ?? 'hidden' }` (attribute may sit on any control of the field; first wins). `formsanity.js`: call `relevance.refresh(name)` inside the delegated input/change handler before field refreshes; field controllers, gate, and gather all skip fields where `isRelevant(name)` is false. Page: a color select with an `Other` text field (`data-fs-relevant="color == 'Other'"` required), a shipping checkbox enabling a notes textarea (`data-fs-irrelevant="disabled"`, expression `ship == 'on'` — checked checkboxes read as their value, unchecked as `''`; document that in the page), and a compound expression row exercising `&&`/`||`/`!`.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -am "feat: relevance engine and instrumentation page"`

### Task 11: Gate + form-level messages + when-valid

**Files:**
- Create: `test/e2e/gate.spec.js`
- Modify: `lib/errors.js`, `lib/formsanity.js`, `instrumentation/index.html`

**Interfaces:**
- Consumes: all field controllers, `isRelevant`, `formMessages`, `ensureStatusRegion`.
- Produces: `updateFormState(controllers, form, relevance)` in `formsanity.js` (called from `ctx.onChange`, debounced with `queueMicrotask`); status region children `<p class="fs-status-incomplete">` and `<p class="fs-status-invalid">` (each `hidden` when clear); submit control gets `disabled` unless every relevant field is `valid`; `[data-fs-when-valid]` elements react (`hide`: `hidden` while valid; `show`: `hidden` while not valid; `enable`: `disabled` while not valid); `data-fs-no-gate` on the form disables gating; `data-fs-message-incomplete` / `data-fs-message-invalid` on the form override the catalog text.

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/index.html'); });

test('gate disables submit and shows the incomplete message', async ({ page }) => {
	await expect(page.locator('button[type="submit"]')).toBeDisabled();
	await expect(page.locator('.fs-status-incomplete')).toBeVisible();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

test('invalid values show the invalid message separately', async ({ page }) => {
	await page.locator('#email').fill('a@@b');
	await expect(page.locator('.fs-status-invalid')).toBeVisible();
});

test('completing the form releases the gate and clears messages', async ({ page }) => {
	await page.locator('#full-name').fill('Jans Carton');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#age').fill('44');
	await expect(page.locator('button[type="submit"]')).toBeEnabled();
	await expect(page.locator('.fs-status-incomplete')).toBeHidden();
	await expect(page.locator('.fs-status-invalid')).toBeHidden();
});

test('when-valid element reacts', async ({ page }) => {
	await expect(page.locator('#ready-note')).toBeHidden();
	await page.locator('#full-name').fill('Jans Carton');
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#age').fill('44');
	await expect(page.locator('#ready-note')).toBeVisible();
});
```

Add `<p id="ready-note" data-fs-when-valid="show">Ready to submit.</p>` above the button in `index.html`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in `errors.js`, `renderStatus(region, { incompleteCount, invalidCount, messages })` creates/updates the two `<p>` elements. In `formsanity.js`:

```js
function updateFormState(state) {
	const { controllers, form, relevance, region } = state;
	let incomplete = 0;
	let invalid = 0;
	for (const c of controllers) {
		if (!relevance.isRelevant(c.field.name)) continue;
		if (c.verdict === 'incomplete') incomplete += 1;
		if (c.verdict === 'invalid') invalid += 1;
	}
	const allValid = incomplete === 0 && invalid === 0;
	if (!form.hasAttribute('data-fs-no-gate')) {
		const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
		if (submit) submit.disabled = !allValid;
	}
	renderStatus(region, {
		incompleteCount: incomplete,
		invalidCount: invalid,
		messages: {
			incomplete: form.getAttribute('data-fs-message-incomplete') ?? formMessages.incomplete,
			invalid: form.getAttribute('data-fs-message-invalid') ?? formMessages.invalid
		}
	});
	for (const el of form.querySelectorAll('[data-fs-when-valid]')) {
		const verb = el.getAttribute('data-fs-when-valid');
		if (verb === 'hide') el.hidden = allValid;
		if (verb === 'show') el.hidden = !allValid;
		if (verb === 'enable') el.disabled = !allValid;
	}
	form.classList.toggle('fs-all-valid', allValid);
}
```

`ctx.onChange` schedules `updateFormState` once per microtask. Initial call at setup.

- [ ] **Step 4: Run to verify pass** — this task's spec plus all earlier e2e (gating now affects the relevance page's submit test — its form must be completable; adjust that page's fields if needed).

- [ ] **Step 5: Commit** — `git commit -am "feat: submit gate, incomplete/invalid form messages, when-valid"`

### Task 12: Behaviors + operations page

**Files:**
- Create: `lib/behaviors.js`, `instrumentation/operations.html`, `test/e2e/behaviors.spec.js`
- Modify: `lib/formsanity.js`

**Interfaces:**
- Consumes: form model, delegated input handler.
- Produces: `attachBehaviors(form, model, ctx)` wiring: `data-fs-copy-to="target-name"` (mirror value on input), `data-fs-amount` / `data-fs-amount-total` (sum numeric values of amount-marked controls into the total control's value or element's text, on input and init), `data-fs-year-options="from,to"` / `data-fs-month-options="from,to"` (generate `<option>`s at init, offsets relative to today, after existing options), `data-fs-reveal` (append `<button type="button" class="fs-reveal" aria-pressed="false">Show</button>` toggling the input between `password`/`text`), maxlength counter (`<small class="fs-counter">` after any `[maxlength]` control, text `{n} characters remaining`, updated on input).

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/instrumentation/operations.html'); });

test('copy-to mirrors', async ({ page }) => {
	await page.locator('#billing-name').fill('Jans');
	await expect(page.locator('#shipping-name')).toHaveValue('Jans');
});

test('amounts sum into the total', async ({ page }) => {
	await page.locator('#donation').fill('25');
	await page.locator('#fee').fill('1.50');
	await expect(page.locator('#total')).toHaveText('26.50');
});

test('year options generate from offsets', async ({ page }) => {
	const year = new Date().getFullYear();
	const options = page.locator('#card-year option');
	await expect(options.nth(1)).toHaveText(String(year));
	await expect(options.last()).toHaveText(String(year + 5));
});

test('reveal toggles the password field', async ({ page }) => {
	await expect(page.locator('#password')).toHaveAttribute('type', 'password');
	await page.locator('li:has(#password) .fs-reveal').click();
	await expect(page.locator('#password')).toHaveAttribute('type', 'text');
});

test('counter counts down', async ({ page }) => {
	await page.locator('#bio').fill('12345');
	await expect(page.locator('li:has(#bio) .fs-counter')).toHaveText('45 characters remaining');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `lib/behaviors.js`** — each behavior is a small function; `attachBehaviors` queries and wires them. Amount parsing strips `$` and `,` (reuse nothing fancier: `Number(value.replace(/[$,]/g, ''))`, `NaN` → 0); totals render with `toFixed(2)`. Month options generate `01 - Jan` … `12 - Dec` values 1–12 windowed by the offsets. Page: billing/shipping copy pair, donation+fee/total, card-year (`<select id="card-year" name="card-year" data-fs-year-options="0,5"><option label="year"></option></select>`), card-month, password with `data-fs-reveal`, textarea `#bio maxlength="50"`.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -am "feat: behaviors — copy-to, amounts, date options, reveal, counter"`

### Task 13: Submitter, hooks, events + submission page

**Files:**
- Create: `lib/submit.js`, `lib/hooks.js`, `instrumentation/submission.html`, `test/e2e/submit.spec.js`
- Modify: `lib/formsanity.js`

**Interfaces:**
- Consumes: controllers, `isRelevant`, dev-server protocol, `formMessages`.
- Produces: `attachSubmit(form, state)`; `addPreSubmitHook(form, asyncFn)` exported from `lib/hooks.js` and re-exported from `lib/formsanity.js` — hook receives `{ form, payload }`, returns an object of extra fields to merge or throws to abort; events `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error` dispatched on the form (bubbling, `detail` carries the envelope). Gathering: relevant fields only; JSON body when no file inputs, `FormData` otherwise; server-rendered hidden inputs always included byte-for-byte. Envelope handling: non-JSON or wrong `formsanity` → `fs:error` + protocol message; `status: 'invalid'` → map `errors[]` onto fields by name (present each; unknown/null field → form-level line in the status region) ; `status: 'accepted'` with `redirect` → `location.assign(redirect)`; else show `message` as success state in the status region.

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

async function complete(page) {
	await page.locator('#email').fill('jans@websanity.com');
	await page.locator('#note').fill('hello');
}

test('accepted submission shows the server message', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('.fs-status')).toContainText('Thanks!');
});

test('rejection maps server errors onto fields', async ({ page }) => {
	await page.goto('/instrumentation/submission.html?scenario=invalid');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});

test('redirect follows', async ({ page }) => {
	await page.goto('/instrumentation/submission.html?scenario=redirect');
	await complete(page);
	await page.locator('button[type="submit"]').click();
	await expect(page).toHaveURL(/submitted\.html/);
});

test('pre-submit hook fields are merged', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await complete(page);
	const posted = page.waitForRequest('**/api/submit*');
	await page.locator('button[type="submit"]').click();
	expect((await posted).postDataJSON().token).toBe('tok_123');
});

test('unique check marks the field from the server', async ({ page }) => {
	await page.goto('/instrumentation/submission.html');
	await page.locator('#email').fill('taken@example.com');
	await page.locator('#email').blur();
	await expect(page.locator('li:has(#email) .fs-error')).toContainText('already in use');
});
```

The page's inline module registers a demo hook: `addPreSubmitHook(form, () => ({ token: 'tok_123' }))`, and copies `location.search` onto the form `action` so the `scenario` query reaches the server. The email field carries `data-fs-unique="/api/unique"`. Include a hidden input `<input type="hidden" name="csrf" value="demo-token">` and assert in the hook test's request body that `csrf` is `demo-token` (round-trip rule).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — `lib/hooks.js`:

```js
const registry = new WeakMap();

export function addPreSubmitHook(form, fn) {
	if (!registry.has(form)) registry.set(form, []);
	registry.get(form).push(fn);
}

export async function runHooks(form, payload) {
	for (const fn of registry.get(form) ?? []) {
		Object.assign(payload, (await fn({ form, payload })) ?? {});
	}
	return payload;
}
```

`lib/submit.js`: intercept the form's `submit` event; validate all relevant controllers (present every outstanding error, focus the first not-valid control, abort unless all valid — with `data-fs-no-gate` this is the enforcement point); set status region to processing state (`fs-processing` class + `formMessages.processing`); gather; `runHooks`; `fetch(form.action, ...)` — JSON: `headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)`; multipart: build `FormData` from relevant fields + hook fields; interpret envelope per the interface block; always clear the processing state. The uniqueness client also lives here: `attachUnique(field, url, ctx)` — on blur with a non-empty valid-so-far value, debounce 300ms, `POST {field, value}`; `unique: false` → present `invalid`/`unique`; HTTP 429 or network failure → clear any unique error and back off (authoritative check happens at submission).

- [ ] **Step 4: Run to verify pass** — full e2e suite.

- [ ] **Step 5: Commit** — `git commit -am "feat: submitter, envelope handling, hooks, uniqueness client"`

### Task 14: Freeform mode + engine polish pass

**Files:**
- Create: `test/e2e/freeform.spec.js`
- Modify: `instrumentation/submission.html` (add a freeform-marked section), `lib/parse.js` if gaps surface

**Interfaces:**
- Consumes: `ROW_SELECTOR` already includes `[data-fs-field]`.
- Produces: verified freeform behavior — a field wrapped in `<div data-fs-field>` outside any list gets row states, bubbles, and relevance hiding exactly like a grammar row.

- [ ] **Step 1: Write the failing spec** — add to `submission.html` a freeform aside: `<div data-fs-field><label for="promo">Promo code</label><input id="promo" name="promo" data-fs-type="alphanum"></div>`; spec asserts dead-end input (`promo!`) flags the wrapper `fs-invalid` and the bubble lands inside it. Also cover the two remaining design contracts: a compound row (two selects sharing one `aria-labelledby` label inside `.compound`, each `required`) where each control gets its own bubble and the shared row reflects the worst member verdict, and a `data-fs-error-to` field whose bubble renders in the designated element instead of the row.

- [ ] **Step 2: Run to verify failure** (or pass — if it passes immediately, keep the spec as regression cover and skip to Step 4).

- [ ] **Step 3: Fix any parser/row-resolution gaps** the spec exposes.

- [ ] **Step 4: Full suite green** — `npm test && npm run test:e2e && npm run lint`.

- [ ] **Step 5: Commit** — `git commit -am "feat: freeform field mode verified"`

### Task 15: Stylesheet — layout

**Files:**
- Modify: `lib/formsanity.css`
- Create: `test/e2e/layout.spec.js`

**Interfaces:**
- Consumes: the document grammar, row state classes, layout classes.
- Produces: the layout half of the shipped stylesheet. Invoke the `writing-html-css` skill before writing (deliberate exception: everything lives in `@layer formsanity`). Knobs defined on `.fs-form` (they are the public API — this exact set):

```css
@layer formsanity {
	.fs-form {
		--fs-font-family: system-ui, sans-serif;
		--fs-font-size: 1rem;
		--fs-gap: 0.75rem;
		--fs-column-gap: 2rem;
		--fs-label-width: max-content;
		--fs-control-padding: 0.4em 0.5em;
		--fs-border-color: hsl(0 0% 70%);
		--fs-border-radius: 0.25rem;
		--fs-focus-color: hsl(210 80% 55%);
		--fs-label-color: inherit;
		--fs-annotation-color: hsl(0 0% 40%);
		--fs-asterisk-color: hsl(0 85% 40%);
		--fs-asterisk-size: 0.5em;
		--fs-error-bkg: hsl(0 85% 40%);
		--fs-error-color: white;
		--fs-status-incomplete-color: hsl(0 0% 25%);
		--fs-status-invalid-bkg: hsl(0 85% 40%);
		--fs-status-invalid-color: white;
		--fs-disabled-opacity: 0.5;
		--fs-toggle-accent: hsl(210 80% 55%);
		--fs-transition-duration: 150ms;
	}
}
```

Container-query breakpoints are fixed lengths (not knobs — size queries cannot read custom properties): left labels at container width `>= 32rem`, multi-column at `>= 52rem`. Sites override by redefining the two `@container` rules in unlayered CSS.

- [ ] **Step 1: Write the failing layout spec** — computed-style assertions:

```js
import { test, expect } from '@playwright/test';

test('wide field group puts labels left in an aligned column', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/instrumentation/index.html');
	const row = page.locator('form[data-fs-form] li').first();
	await expect(row).toHaveCSS('display', 'grid');
	const label = row.locator('label');
	const input = row.locator('input');
	const lb = await label.boundingBox();
	const ib = await input.boundingBox();
	expect(lb.x + lb.width).toBeLessThanOrEqual(ib.x);
});

test('narrow container stacks labels on top', async ({ page }) => {
	await page.setViewportSize({ width: 420, height: 800 });
	await page.goto('/instrumentation/index.html');
	const row = page.locator('form[data-fs-form] li').first();
	const lb = await row.locator('label').boundingBox();
	const ib = await row.locator('input').boundingBox();
	expect(lb.y + lb.height).toBeLessThanOrEqual(ib.y);
});

test('cols group is multi-column when wide', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/instrumentation/types.html');
	const group = page.locator('.cols').first();
	await expect(group).toHaveCSS('grid-template-columns', /\d+.*\d+/);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write the layout CSS** — inside `@layer formsanity`, in this order: form base (font knobs, `container-type: inline-size` on the form and on field groups), field-group `ul` as grid (`grid-template-columns: subgrid`-based rows: each `li` spans the group grid with `grid-template-columns: subgrid`, label column `auto`/right-aligned via `justify-self: end` inside the `>= 32rem` container query; below it, single column with label above), annotation (`small`) placed in the control column below the field, `.block` (label above, full width), `.cols` (`@container (width >= 52rem)` → two-column grid, `col-break` starts a new column via `grid-column-start`), `.compound` (inline flex of controls sharing the row's control cell), control styling (padding, border, radius, focus ring via `:focus-visible` outline using `--fs-focus-color`), `fieldset`/`legend` section styling. Follow the `writing-html-css` declaration-order and nesting rules; `hsl()` colors only; range syntax in queries; tabs; no blank lines inside rule blocks.

- [ ] **Step 4: Run to verify pass** — layout spec + full e2e (earlier specs must not break from visual changes).

- [ ] **Step 5: Visual review** — `npm run serve`, then `agent-browser --headed open http://localhost:8347/instrumentation/index.html` and walk all pages at wide and narrow widths; fix what looks wrong. Compare against v1's pages (`cd ~/dev/websanity-meta/formsanity-client && npm start`) for UX fidelity.

- [ ] **Step 6: Commit** — `git commit -am "feat: stylesheet layout — grammar, labels, columns, container queries"`

### Task 16: Stylesheet — states and widgets

**Files:**
- Modify: `lib/formsanity.css`
- Create: `test/e2e/states.spec.js`

**Interfaces:**
- Consumes: `fs-*` state classes and engine-written elements.
- Produces: the presentation half — asterisk indicators, error bubbles, status region, toggle lists, reveal button, counter, disabled/irrelevant states.

- [ ] **Step 1: Write the failing spec**

```js
import { test, expect } from '@playwright/test';

test('not-valid rows show the label asterisk', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	const label = page.locator('li.fs-incomplete label').first();
	const content = await label.evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
	expect(content).toContain('svg');
});

test('error bubble is styled as a bubble', async ({ page }) => {
	await page.goto('/instrumentation/index.html');
	await page.locator('#email').fill('a@@b');
	const bubble = page.locator('li:has(#email) .fs-error');
	await expect(bubble).toBeVisible();
	const radius = await bubble.evaluate((el) => getComputedStyle(el).borderRadius);
	expect(radius).not.toBe('0px');
});

test('toggle buttons render as buttons', async ({ page }) => {
	await page.goto('/instrumentation/choice-groups.html');
	const label = page.locator('.toggle-list.buttons li label').first();
	const display = await label.evaluate((el) => getComputedStyle(el).display);
	expect(display).not.toBe('inline');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write the states CSS** — asterisk: `li:is(.fs-incomplete, .fs-invalid) > label::after` (and the block/freeform equivalents) drawing v1's red-asterisk SVG as a data-URI background sized by `--fs-asterisk-size`, colored via the SVG's own fill matched to `--fs-asterisk-color`'s default (note in a comment that recoloring means replacing the data URI — SVG-in-background can't read custom properties). Bubble: `--fs-error-bkg` background, `--fs-error-color` text, radius, and a `::after` tail like v1's. Status region: incomplete line with the asterisk icon + `--fs-status-incomplete-color`; invalid line as a bubble-styled banner; processing/success states styled off `fs-processing` / `fs-success` classes. Toggle lists: hide the native input visually (keep it focusable), style the wrapping label as list rows; `.buttons` variant renders labels as toggle buttons using `--fs-toggle-accent` for the checked state (`li:has(:checked) label`). Reveal button and counter styling. Irrelevant (`fs-irrelevant`) uses `display: none` via `[hidden]`; disabled mode gets `--fs-disabled-opacity`. Transitions on state changes via `--fs-transition-duration`.

- [ ] **Step 4: Run to verify pass** — full e2e suite.

- [ ] **Step 5: Visual review** — repeat the Task 15 walk-through, all pages, both widths, exercising errors, gating, toggling. Fix until the UX reads like v1's.

- [ ] **Step 6: Commit** — `git commit -am "feat: stylesheet states — asterisks, bubbles, status, toggles"`

### Task 17: Vocabulary spec

**Files:**
- Create: `specs/vocabulary.md`

**Interfaces:**
- Consumes: the implementation (as evidence), the design doc, `vectors/*.json`.
- Produces: the normative vocabulary spec any backend can implement without reading `lib/`.

- [ ] **Step 1: Write the document.** Sections, in order — each is normative prose plus tables, no code from `lib/`: Scope & conformance (what a client engine and a server parser each MUST do; the test vectors as conformance suite); Document grammar (structured mode, `data-fs-form`, sections, field groups, rows, annotations, `data-fs-field` freeform, choice groups; the row-resolution rule); Native register (the Task 2 table plus the numeric-type mapping paragraph from the design); `data-fs-type` (the full/prefix regex table verbatim from Task 2, function types described algorithmically); Three-state validation (definitions of valid/incomplete/invalid, the appending rule, `ValidityState` mapping table, submit-time collapse); Rules (every `data-fs-*` rule attribute: syntax, semantics, verdict, code — reuse the shared reference table); Relevance (expression attribute, modes, the normative server obligation); Expression grammar (the EBNF from Task 1, semantics paragraphs, vector file format); Behaviors (copy-to, amounts, date options, reveal, counter, when-valid — marked client-only: servers MUST ignore them); Presentation contract (engine-written DOM: bubbles, status region, row classes, ARIA wiring; the knob list; the two container breakpoints and the override recipe); Layout classes (marked non-normative for servers). Follow the global Markdown constraints; pad every table.

- [ ] **Step 2: Verify by cross-reading.** Walk `lib/parse.js`, `lib/rules.js`, `lib/validators.js`, `lib/expression.js` attribute-by-attribute against the spec: every attribute the code reads appears in the spec with matching semantics, and the spec names no attribute the code ignores. Fix mismatches (in the spec, or in the code with tests if the code is wrong).

- [ ] **Step 3: Lint the examples.** Every markup example in the spec uses tabs, `data-fs-*`, and the document grammar; validate one full example page mentally against `parseForm`.

- [ ] **Step 4: Commit** — `git commit -am "docs: vocabulary spec"`

### Task 18: Submission protocol spec

**Files:**
- Create: `specs/submission-protocol.md`

**Interfaces:**
- Consumes: `lib/submit.js`, `test/server.js` behavior, the design doc's envelope section.
- Produces: the normative protocol spec.

- [ ] **Step 1: Write the document.** Sections: Version (`formsanity: 2`, additive vs breaking, client rejection of higher majors); Request (target resolution, JSON vs multipart choice rule, field naming, irrelevant-field omission, hidden-field round-trip, the server's relevance obligation and `relevance` error code); Response envelope (the three JSON shapes from the design, verbatim, with every property's type and requiredness in a table); Error codes (the shared table, marked as the closed set for v2 — servers MAY add codes prefixed `x-`); Uniqueness sub-protocol (request/response shapes, 429 semantics, client back-off, submission-time authority); Security exclusions (auth, captcha verification, storage are out of scope; captcha/payment tokens travel as hook-injected fields the client does not interpret); Reference implementation note pointing at `test/server.js`.

- [ ] **Step 2: Verify by cross-reading** `lib/submit.js` and `test/server.js` against the document; fix mismatches.

- [ ] **Step 3: Commit** — `git commit -am "docs: submission protocol spec"`

### Task 19: Port mock forms

**Files:**
- Create: `forms/pfems-join.html`, `forms/meteoritical-donate.html`, `forms/pfems-profile.html`, one file-upload form, `forms/PORTING.md`, `test/e2e/forms.spec.js`

**Interfaces:**
- Consumes: everything.
- Produces: production-scale integration fixtures + the seed migration playbook.

- [ ] **Step 1: Pick the file-upload form** — `grep -l 'type="file"' ~/dev/websanity-meta/formsanity-client/public/mock/*.html`; choose the match with the most conditional logic (break ties by field count). If no mock form has a file input, port `issl-job-post.html` and add a `data-fs-max-file-size="2MB"` attachment field to its v2 version, noting the addition in `PORTING.md`.

- [ ] **Step 2: Port the four forms.** Invoke `writing-html-css` first. For each: read the v1 file; rewrite in the v2 grammar (v1 attribute → v2 per the design's disposition and mapping tables — `data-required`→`required`, `data-type`→native or `data-fs-type`, `data-display`→`data-fs-relevant`, `data-all-are-valid` on the button→delete (gating is default), Stripe fields→a demo pre-submit hook stub injecting `token`, layout markup→grammar + layout classes); `action="/api/submit"`. Record every non-mechanical judgment call in `forms/PORTING.md` as a translation-rule list (this file seeds the migration playbook).

- [ ] **Step 3: Write the failing e2e spec** — for each form: page loads with zero console errors, gate starts disabled, filling the minimal valid path enables it, submission reaches the dev server and is accepted; for the conditional membership form, assert one relevance-driven section toggles; for the upload form, attach a small file and a >2MB file.

- [ ] **Step 4: Run, fix, pass** — porting will surface engine bugs; fix them with regression tests in the task where the buggy module lives.

- [ ] **Step 5: Commit** — `git commit -am "feat: port four v1 mock forms as integration fixtures"`

### Task 20: README + final sweep

**Files:**
- Modify: `README.md`
- Create: nothing new

- [ ] **Step 1: Write `README.md`** — what FormSanity is, quick start (the two-line `<link>` + `<script type="module">` embed with a minimal grammar example), pointers to `specs/`, instrumentation pages (`npm run serve`), test commands, the no-build distribution note, browser floor, and the knob-theming one-liner.

- [ ] **Step 2: Full verification** — `npm run lint && npm test && npm run test:e2e`; every command's real output green. Walk all instrumentation pages once in a headed browser.

- [ ] **Step 3: Update `CLAUDE.md` Current Status** to "implemented; see README" (one line), keeping ground rules intact.

- [ ] **Step 4: Commit** — `git commit -am "docs: README and status updates"`

## Self-Review Notes

- Spec coverage: vocabulary (Tasks 1–2, 7–10, 17), three-state model (2, 6), relevance (10), gate/messages (11), behaviors incl. recovered capabilities — date options, reveal, counter, toggle lists, col-break (12, 9, 15–16), protocol + uniqueness + hooks + hidden-field round-trip (4, 13, 18), UI/UX fidelity (15–16), freeform (14), instrumentation as product (5–13), ported forms + playbook (19), no-build distribution and floor (global constraints, 20).
- Deferred-items from the design all land here: module layout (File Structure), prefix patterns + vectors (Task 2), knob inventory + breakpoints (Task 15), message catalog (Task 3), mock-form choice (Task 19).
