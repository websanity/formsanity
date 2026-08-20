# FormSanity v2 Design

**Date:** 2026-08-20. **Status:** approved design for sub-project 1. This document records the design dialogue's decisions and is the source for the implementation plan. It builds on `2026-08-20-formsanity-v2-charter.md`; where the two disagree, this document wins.

## Decisions That Supersede the Charter

The design dialogue overturned two charter positions.

- **The vocabulary is redesigned, not preserved.** The charter called for v1 attribute compatibility modulo pruning. v2 instead promises _capability parity_: everything real v1 forms could express, v2 can express, but attribute names, structure, and semantics are redesigned where v1 got them wrong. Migrating a v1 form means translating its markup, not dropping in a new script.
- **The v1 `mock/` corpus is a checklist, not a fixture set.** The charter framed the ~28 mock forms as compatibility test fixtures. Because the markup changes, v2 instead builds new instrumentation pages as its primary fixtures, ports a representative subset of mock forms, and uses the untouched v1 corpus as a read-only capability audit. The `mock/` directory holds only a residue of the forms built on v1; absence of a feature there is weak evidence, and `instrumentation/` defines the vocabulary floor.

## Artifacts

Sub-project 1 produces five artifacts in this repo.

1. **The library** — dependency-free ES modules plus a first-class stylesheet. The source is the distribution: no build step, no `dist/`, loaded with `<script type="module">` and `<link>`. Code targets the Baseline Widely Available feature set.
2. **The vocabulary spec** — the normative definition of form markup: the native-HTML register, the `data-fs-*` register, the document grammar, the expression grammar, and the three-state validation model, with shared test vectors.
3. **The submission protocol spec** — request format, response envelope, error codes, the uniqueness-check sub-protocol, and the round-trip rule for server-defined hidden fields.
4. **Instrumentation pages** — per-feature reference pages in v2 markup. They are living documentation of the vocabulary spec and the Playwright integration fixtures. Unlike v1's, they are a product artifact.
5. **Ported mock forms** — three to five representative v1 forms (a large conditional membership join, a donation form exercising the pre-submit hook, a profile edit, a file-upload form) translated to v2 markup. Porting stress-tests the vocabulary and seeds the sub-project 3 migration playbook.

## Vocabulary

### Principles

Native HTML is canonical wherever it can express a rule; `data-fs-*` exists only for what the platform lacks. Every attribute has one meaning, evaluable both by the JS engine and by a server parser reading static markup. All FormSanity attributes use the `data-fs-` prefix — fully conforming HTML, one name per attribute. The engine sets `novalidate` and owns error presentation, but native attributes still give a no-JS validation floor.

### Native Register

These v1 attributes dissolve into standard HTML.

| v1 attribute                             | v2 native equivalent                  |
|------------------------------------------|---------------------------------------|
| `data-required`                          | `required`                            |
| `data-min-length` / `data-max-length`    | `minlength` / `maxlength`             |
| `data-min-value` / `data-max-value`      | `min` / `max`                         |
| `data-pattern`                           | `pattern`                             |
| `data-file-extension`                    | `accept`                              |
| `data-type="email"` / `"url"` / `"date"` | `type="email"` / `"url"` / `"date"`   |
| `data-type` number and integer variants  | `type="number"` with `min` and `step` |

The five v1 numeric types map mechanically: `number` → `type="number"`; `nonnegative-number` → `min="0"`; `positive-number` → `min="0"` plus an engine check for zero; `integer` → `step="1"`; the nonnegative and positive integer variants combine `min` and `step`. `ValidityState` (`badInput`, `stepMismatch`, `rangeUnderflow`, `rangeOverflow`) covers them all.

### Field Types

`data-fs-type` names formats HTML cannot check: `alpha`, `alphanum`, `identifier`, `no-whitespace`, `email-list`, `ip`, `ipv4`, `ipv6`, `credit-card` (Luhn plus an allowed-network list), `cvv`, `us-phone`, `international-phone`, `ssn`, `time`, `duration`, `us-dollar`, `zip`. The first four are expressible as `pattern`, but keeping them buys semantic error messages and shared server meaning for one regex each.

### Cross-Field Rules

`data-fs-equals` and `data-fs-not-equals` compare against a literal value. `data-fs-equals-field`, `data-fs-not-equals-field`, `data-fs-greater-than-field`, and `data-fs-less-than-field` compare against another field, chronologically when both operands are dates.

### Groups

`data-fs-group-at-least-one="name"` and `data-fs-group-all-or-none="name"` mark member fields, as v1's `data-required-at-least-one` and `data-required-all-or-none` did. `data-fs-min-selected` and `data-fs-max-selected` bound checkbox sets. `data-fs-unique-in-page="name"` requires mutually distinct values among its members. `data-fs-unique` invokes the server-checked uniqueness sub-protocol.

### Password Composition

`data-fs-min-digits`, `data-fs-min-uppercase`, and `data-fs-min-lowercase` replace v1's `data-min-length-digit` family, which read as length constraints but counted character classes.

### Files

`data-fs-max-file-size` caps upload size and accepts human units (`"2MB"`); the spec defines the unit grammar precisely. Extension filtering is native `accept`.

### Relevance

Conditional logic uses WebSanity's historical term _relevance_ (the same concept XForms called `relevant`). `data-fs-relevant="expr"` carries the expression; `data-fs-irrelevant="hidden|disabled"` chooses how an irrelevant field presents, defaulting to `hidden`. An irrelevant field is not validated, is not submitted, and hides or disables together with its row and label. Relevance is normative: a server evaluating the same markup must treat a submitted value for an irrelevant field as a validation failure. This unifies v1's `data-display` and `data-enable`, which were one concept with two presentations.

### Behavior

`data-fs-copy-to` mirrors a field's value into another field (v1's `data-copy-value-to`). `data-fs-amount` and `data-fs-amount-total` sum marked numeric fields into a total element, as in v1. `data-fs-when-valid="hide|show|enable"` makes any element react to whole-form validity, generalizing v1's `data-all-are-valid`: `hide` hides the element while the form is valid (v1's readiness-message pattern), `show` is its inverse, and `enable` enables the element only while the form is valid. The common cases — submit button and readiness message — need no markup because the engine handles them by default (see UI).

### Error Presentation Attributes

`data-fs-label` names the field in messages, falling back to the associated `<label>` text — a v2 improvement; v1 had no fallback chain. `data-fs-error-to` overrides where a field's message renders. `data-fs-no-gate` on the form opts out of default submit gating (v1's `data-ignore-all-valid`, inverted into an opt-out).

### Expression Grammar

One page of the vocabulary spec defines the grammar shared by `data-fs-relevant` and any future expression attribute. Operands are field names, single-quoted strings, and numbers. Operators are `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, and `!`, with parentheses. The empty string is the unanswered value. Date-typed fields compare chronologically. The grammar has no functions; one gets added when a real form needs it. A shared test-vector file (expression plus field values → expected boolean) pins both the JS evaluator and the Concrete PHP evaluator to the spec.

### Three-State Validation

Type validators return one of three verdicts rather than a boolean: **valid**, **incomplete** (appending characters could produce a valid value — `jans@web` for email, `192.168.` for ipv4), or **invalid** (a dead end no continuation can fix — a letter in a number field, a dash in an octet). Each format type carries a prefix pattern alongside its full pattern to define the boundary. Native constraints map through `ValidityState`: `badInput` and `rangeOverflow` are dead ends; `rangeUnderflow` and `tooShort` are incomplete. At submit time, incomplete collapses into invalid, so the server and the protocol see only two states. The timing consequences appear under UI; the test vectors carry all three verdicts.

### Disposition of Every v1 Attribute

Attributes not already mapped above.

| v1 attribute                                                                       | v2 disposition                                                         |
|------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `data-type="stripe-credit-card"`                                                   | Pruned; payment tokens ride the pre-submit hook                        |
| `data-recaptcha`, `data-hcaptcha`, `data-sitekey`                                  | Pruned; captcha tokens ride the pre-submit hook                        |
| `data-marker`, `data-marker-showing`                                               | Pruned with the marker machinery                                       |
| `data-multi_column_breakpoint`, `data-left_label_breakpoint`                       | Pruned with the layout machinery                                       |
| `data-day`, `data-month-offset`, `data-year-offset`, `data-pika-*`                 | Pruned with the pickers; dates are native inputs                       |
| `data-label`, `data-prefix`, `data-suffix`, `data-error-element`, `data-attribute` | Engine-written internals, never authored; v2's error DOM replaces them |
| `data-url_fill`                                                                    | Pruned; no corpus usage                                                |
| `data-equal-to-than-field`                                                         | Dead alias in v1; not carried forward                                  |
| `data-all-are-valid`                                                               | Default engine behavior plus `data-fs-when-valid`                      |

## Client Engine

### Units

Each unit is an ES module or a small cluster; the implementation plan fixes the file split.

- **Rule parser** — reads a form's markup once at init into a plain rule model: per-field rules, groups, relevance expressions, dependencies. It is the JS twin of Concrete's PHP parser; the shared test vectors keep both honest.
- **Validators** — type checkers and constraint evaluators as pure functions returning three-state verdicts. No DOM; unit-tested under `node:test`.
- **Expression engine** — parser and evaluator for the relevance grammar. Pure; pinned by the spec's test vectors.
- **Field state controller** — tracks per-field validity, wires `input`, `change`, and `blur`, and merges native `ValidityState` with `data-fs-*` results into one verdict per field.
- **Relevance engine** — builds the dependency graph from relevance, copy, and amount attributes, and re-evaluates affected expressions when a dependency changes. Applies the irrelevance rules: skip validation, skip submission, hide or disable the row.
- **Error presenter** — renders the spec'd error DOM (message element linked by `aria-describedby`, `aria-invalid` on the control, state classes on the row) and the form-level status region, honoring `data-fs-label` and `data-fs-error-to`. The default message catalog is one replaceable module.
- **Submitter** — validates all relevant fields, runs pre-submit hooks, gathers the payload, posts it, and interprets the envelope: render per-field server errors or follow `redirect`.
- **Hook and event surface** — `addPreSubmitHook(form, asyncFn)` registers a hook that returns extra fields to merge into the submission or throws to abort. Stripe tokens, captcha tokens, and anything else the server wants travel this way; the library never knows what they mean. The engine dispatches `CustomEvent`s (`fs:init`, `fs:field-valid`, `fs:field-invalid`, `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error`) so site code observes without patching.

### Discovery and Init

Forms opt in with `data-fs-form` on the `<form>` element, which also anchors the PHP parser. The module has no import side effects; sites call `init(root?)` explicitly. Scoped init keeps the module clean for testing and lets a Concrete page initialize only its own block's form.

### Server-Defined Hidden Fields

Plain `<input type="hidden">` elements need no client mechanism: the engine gathers them like any field and round-trips them untouched. The protocol spec formalizes the obligation.

## Submission Protocol

### Request

The client posts to the form's `action`, or to the current URL when `action` is absent. The body is `application/json` when the form has no file fields and `multipart/form-data` when it does; keys are the fields' `name` attributes. Irrelevant fields are omitted. Server-rendered hidden inputs are round-tripped byte for byte.

### Envelope

HTTP status carries the outcome class; the body adds detail. Every response carries `formsanity: 2`.

`200 OK` — accepted:

```json
{
	"formsanity": 2,
	"status": "accepted",
	"message": "Thanks for joining!",
	"redirect": "https://example.org/welcome"
}
```

`422 Unprocessable Content` — validation rejected:

```json
{
	"formsanity": 2,
	"status": "invalid",
	"errors": [
		{ "field": "email", "code": "type.email", "message": "Not a valid email address" }
	]
}
```

Other `4xx`/`5xx` — processing failure:

```json
{
	"formsanity": 2,
	"status": "error",
	"message": "Could not store submission"
}
```

`redirect` is explicit; v1's convention of smuggling a URL through `message` is retired, as is the `Validation Error` magic string and the `{ok, result}` double wrapping.

### Error Codes

Each `errors[]` entry is `{field, code, message}`. Codes are spec-enumerated and mirror the vocabulary — `required`, `type.email`, `minlength`, `group.at-least-one`, `unique`, `relevance` (a value arrived for an irrelevant field) — so a client maps any server rejection back to the offending rule and field without parsing prose. `message` is the human-readable fallback; `field` is null for form-level errors.

### Uniqueness Sub-Protocol

`data-fs-unique`'s value is the check endpoint URL. On blur, debounced, the client posts `{field, value}` and expects `{formsanity: 2, unique: true}` or `false`. A `429` means rate-limited: the client backs off without marking the field invalid, because the authoritative check happens at submission. Any backend can implement the sub-protocol; Concrete's consults Express entries.

### Versioning

`formsanity: 2` is the protocol version. Additive changes keep the integer; breaking changes bump it. The client rejects envelopes whose version exceeds the one it speaks.

### Exclusions

Authentication, captcha verification, and storage semantics are server-side concerns invisible to the client and outside the spec. The reference dev server in this repo implements the whole protocol and serves as the executable specification for backend authors.

## UI and Markup Conventions

### Structured Mode

The default authoring mode is a small document grammar in v1's image: `form[data-fs-form]` contains sections (`fieldset` with `legend`), sections contain field groups (`ul`), and each `li` is one field row holding a `label` and its control. The engine infers each control's row from the grammar: the error element renders inside the row, state classes land on the row, and relevance hides or disables the row whole. v1's extra `div` around each control is dropped. The shipped stylesheet styles this grammar completely.

```html
<form data-fs-form action="/join" method="post">
	<fieldset>
		<legend>Contact</legend>
		<ul>
			<li>
				<label for="email">Email</label>
				<input id="email" name="email" type="email" required>
			</li>
			<li>
				<label for="zip">ZIP code</label>
				<input id="zip" name="zip" type="text" data-fs-type="zip">
			</li>
		</ul>
	</fieldset>
	<button type="submit">Join</button>
</form>
```

### Freeform Mode

For layouts outside the grammar, authors mark each row boundary with `data-fs-field` on a wrapper around the label and control. The engine resolves a control's row as its closest ancestor matching the spec'd row selector — the structured grammar's row elements or an explicit `data-fs-field` — so the two modes are one mechanism.

### Shipped Stylesheet

The library ships a first-class stylesheet: complete out-of-the-box form styling, themed through a documented set of custom-property knobs covering colors, spacing, typography, error treatment, and state transitions. Knobs are public API with the same compatibility guarantees as attributes. The stylesheet lives in a named cascade layer (`@layer formsanity`) so unlayered site CSS outranks it without specificity fights — the library is framework CSS from the site's perspective. It loads with a `<link>`; the engine never injects styles.

### Error Timing

Dead-end verdicts render immediately on input: a letter in a number field is an error the moment it is typed. Incomplete verdicts defer to blur: no yelling about a half-typed email address. Once a field has shown an error, it re-validates on every input so the error clears the moment the value is fixed. A submit attempt reveals all outstanding errors and focuses the first invalid field.

### Readiness Gate

Submit gating is default engine behavior. The submit button carries a real `disabled` attribute until the form validates — v1's familiar feel — and the engine generates a readiness message region above it: `aria-live`, default text from the message catalog, overridable per form, styled through knobs, cleared when the form becomes valid. The same region carries the processing, success, and server-error states after submission, replacing v1's three hand-placed alert `div`s. `data-fs-no-gate` opts a form out.

### Relevance Presentation

Irrelevant fields hide by default or disable with `data-fs-irrelevant="disabled"`, row and label together. Iconography, the exact knob inventory, and hide/show transitions are settled while building the stylesheet and instrumentation pages, where they can be seen.

## Testing

Pure logic — validators and the expression engine — runs under `node:test` with zero setup. Everything DOM-touching runs in real Chromium under Playwright: the instrumentation pages are the per-feature fixtures, the ported mock forms exercise production-scale combinations, and both run against the reference dev server, built on bare `node:http`, which implements the full protocol including rejection, redirect, and the rate-limited uniqueness check. Shared test vectors — expression cases and three-state validator cases as JSON — are consumed by the node tests now and by Concrete's PHPUnit suite in sub-project 2; when the JS and PHP implementations disagree, the vectors prove which one is wrong. Production dependencies: none. Development dependencies: Playwright and ESLint.

## Distribution

The ES module source and the stylesheet are the artifacts. No build step, no `dist/`, versioned by git tag. The Baseline Widely Available floor is written into the spec so future work knows what syntax and APIs are in bounds.

## Deferred to the Implementation Plan

- Module file layout and directory structure.
- The full type-by-type prefix patterns and the initial test-vector corpus.
- The knob inventory and the stylesheet's visual design, developed with the instrumentation pages.
- The exact wording of the default message catalog.
- Which three to five mock forms to port.
