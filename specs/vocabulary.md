# FormSanity Vocabulary Specification

**Version:** 2. **Status:** normative.

FormSanity forms carry their own logic. Validation rules, cross-field comparisons, and conditional display are written into the markup as native HTML constraint attributes and `data-fs-*` attributes; an implementation reads the markup and enforces what it finds. This document defines that vocabulary completely, so that a client engine, a server-side parser, or any other consumer can implement it without reading another implementation's source.

The companion document `submission-protocol.md` defines the request format, the response envelope, the error-code payload, and the uniqueness sub-protocol. This document owns the markup; that one owns the wire.

## Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as defined in RFC 2119.

_Author_ means the person writing the form's markup. _Client engine_ means an implementation running in the browser against a live DOM. _Server parser_ means an implementation reading the same markup statically — as a template, a stored document, or a re-render — and validating a submitted payload against it. _Control_ means an `input`, `select`, or `textarea` element with a `name`. _Field_ means every control in a form sharing one `name`.

Attribute values are case-sensitive unless stated otherwise. Every attribute this specification defines carries the `data-fs-` prefix; markup is fully conforming HTML.

## Scope and Conformance

This specification defines four registers, and an implementation's conformance is measured separately in each.

| Register                   | What it covers                                                                                 | Who enforces it              |
|----------------------------|------------------------------------------------------------------------------------------------|------------------------------|
| Native register            | HTML's own constraint attributes: `required`, `minlength`, `pattern`, `min`, `accept`, and kin | Client engine, server parser |
| `data-fs-*` rules          | Formats, cross-field comparisons, groups, composition, and file limits                         | Client engine, server parser |
| Relevance                  | `data-fs-relevant` and its expression grammar                                                  | Client engine, server parser |
| Behaviors and presentation | Value mirroring, totals, generated options, error DOM, status region                           | Client engine only           |

A conforming **client engine** MUST implement all four registers. It MUST take over presentation of validation errors: it sets `novalidate` on the form and renders the error DOM this document specifies.

A conforming **server parser** MUST implement the native register, the `data-fs-*` rules, and relevance. It MUST ignore the behavior and presentation attributes entirely — they describe browser conveniences with no bearing on whether a submission is acceptable. It MUST NOT depend on layout classes.

A server parser MUST NOT trust a submitted value because the client accepted it. Every rule this document marks as server-enforceable is re-checked at the server, and the server's verdict is authoritative.

### Conformance Suite

Two JSON vector files in `vectors/` are the shared conformance corpus. Both are normative: an implementation that disagrees with a vector is wrong.

| File                       | Entry shape                                  | Pins                                     |
|----------------------------|----------------------------------------------|------------------------------------------|
| `vectors/validators.json`  | `{ "type", "value", "param"?, "expected" }`  | The `data-fs-type` three-state verdicts  |
| `vectors/expressions.json` | `{ "expr", "fields", "types"?, "expected" }` | The expression grammar and its semantics |

`expected` in `validators.json` is one of `"valid"`, `"incomplete"`, `"invalid"`. `expected` in `expressions.json` is a boolean. In `expressions.json`, `fields` maps field name to raw string value, and the optional `types` marks a field as `"date"` for chronological comparison; a name absent from `fields` reads as the empty string.

### Browser Floor

The reference client engine targets the Baseline Widely Available feature set: container size queries, subgrid, native CSS nesting, and `@layer` are in bounds; container style queries are not. Implementations MAY target more, but markup written to this specification MUST NOT require anything beyond it.

## Document Grammar

FormSanity reads two things from the document: which controls belong to which _row_, and which attributes those controls carry. The grammar exists to make the first question answerable without any FormSanity-specific wrapper elements.

### Opting In

A form opts in with the `data-fs-form` attribute on its `form` element. The attribute takes no value.

```html
<form data-fs-form action="/join" method="post">
	…
</form>
```

A client engine MUST process only forms carrying `data-fs-form`, and a server parser MUST treat `data-fs-form` as the anchor for everything below it. A form's `action` names the submission endpoint; when `action` is absent the client posts to the current URL.

### Structure

The default authoring mode is a small document grammar built from ordinary HTML.

- The form contains **sections**: `fieldset` elements, each opened by a `legend` that names the section. A `p` after the legend is section-level prose.
- A section contains **field groups**: `ul` elements.
- A field group contains **rows**: `li` elements.
- A row contains a `label`, the row's control or controls, and an optional `small` **annotation** describing the field.

```html
<form data-fs-form action="/join" method="post">
	<fieldset>
		<legend>Contact</legend>
		<ul>
			<li>
				<label for="email">Email</label>
				<input id="email" name="email" type="text" data-fs-type="email" required>
			</li>
			<li>
				<label for="zip">ZIP code</label>
				<input id="zip" name="zip" type="text" data-fs-type="zip">
				<small>Five digits, or ZIP+4.</small>
			</li>
		</ul>
	</fieldset>
	<button type="submit">Join</button>
</form>
```

A row's label MUST be the row's first element child. Everything else in the row is the row's content.

### Freeform Rows

For layouts the grammar does not cover, an author marks a row explicitly with `data-fs-field` on a wrapper around the label and its control. The attribute takes no value. A freeform row wrapper MUST be a flow container — a `div` is the expected element.

```html
<div data-fs-field>
	<label for="promo">Promo code</label>
	<input id="promo" name="promo" data-fs-type="alphanum">
</div>
```

Freeform rows are independent of one another: each sizes its own label column, so labels line up across rows only inside a field group. Authors who want aligned labels SHOULD use a field group.

### Row Resolution

A field's row is the closest ancestor of its first control matching the selector `li, [data-fs-field], .block`. This one rule covers both authoring modes: the structured grammar's `li`, the `block` field layout, and an explicit `data-fs-field` wrapper all answer to it.

A field whose controls number two or more and whose first control is a checkbox or a radio button — a **choice group** — has no row. Implementations MUST fall back to the field's closest ancestor `fieldset` for row-scoped presentation. Consequences are spelled out under Relevance and the Presentation Contract.

A row MAY host more than one field; a compound field is exactly that case. When it does, the row's state reflects the **worst** verdict among the fields on it, in the order `invalid` < `incomplete` < `valid`. Error messages remain per-field.

### Choice Groups

Radio and checkbox sets use their own grammar: a `fieldset` whose `legend` is the group's label, containing a `ul` of `li` rows, each row a `label` wrapping its own input.

```html
<fieldset class="toggle-list">
	<legend>Toppings</legend>
	<ul>
		<li>
			<label><input type="checkbox" name="toppings" value="pepperoni" data-fs-min-selected="1" data-fs-max-selected="2"> Pepperoni</label>
		</li>
		<li>
			<label><input type="checkbox" name="toppings" value="mushrooms"> Mushrooms</label>
		</li>
	</ul>
</fieldset>
```

A rule attribute that applies to a choice group as a whole (`data-fs-min-selected`, `data-fs-max-selected`, `data-fs-group-at-least-one`, `data-fs-group-all-or-none`, `data-fs-relevant`, `data-fs-irrelevant`) MAY sit on any member control of the set; the first member carrying the attribute wins. Every other attribute is read from the field's first control only.

### Compound Fields

Several controls MAY share one label. The shared label becomes a `span` with an `id`, and each control points at it with `aria-labelledby`; a `div.compound` wraps the controls.

```html
<li>
	<span id="name-label">Name</span>
	<div class="compound">
		<input id="first-name" name="first-name" data-fs-type="alpha" aria-labelledby="name-label" placeholder="First">
		<input id="last-name" name="last-name" data-fs-type="alpha" aria-labelledby="name-label" placeholder="Last">
	</div>
</li>
```

Each inner control keeps its own `name` and its own validation attributes, so each is a separate field. Both fields resolve to the same row, and the worst-verdict rule above governs the row's state.

A compound row's label is a `span`, not a `label`, so the automatic naming chain described under Message Attributes cannot find it and falls through to the field's `name`. Compound controls SHOULD therefore carry `data-fs-label` — one shared label names the row, but each control needs its own name in a message.

### Hidden Fields

A server MAY render `input[type="hidden"]` elements into the form. They need no FormSanity attribute: an engine gathers them like any other field and round-trips their values untouched. The obligation is formalized in `submission-protocol.md`.

## Native Register

Native HTML is canonical wherever it can express a rule. An author MUST prefer the native attribute over any `data-fs-*` equivalent, and FormSanity defines no `data-fs-*` attribute that duplicates one.

| Constraint            | Native attribute        | Notes                                                              |
|-----------------------|-------------------------|--------------------------------------------------------------------|
| Answer required       | `required`              | See the note on choice groups under Native Verdicts                |
| Minimum length        | `minlength`             | Text-like controls                                                 |
| Maximum length        | `maxlength`             | Text-like controls; also drives the characters-remaining counter   |
| Minimum value         | `min`                   | Numeric and date controls                                          |
| Maximum value         | `max`                   | Numeric and date controls                                          |
| Format by pattern     | `pattern`               | An unanchored ECMAScript regex, implicitly anchored by HTML        |
| File extension filter | `accept`                | File controls                                                      |
| Email address         | `type="email"`          | HTML's own definition; see the note under `data-fs-type` below     |
| URL                   | `type="url"`            |                                                                    |
| Date                  | `type="date"`           | Also marks the field as date-typed for comparisons and expressions |
| Time                  | `type="time"`           | Value is always 24-hour `HH:MM` regardless of the locale's display |
| Date and time         | `type="datetime-local"` | Value is `yyyy-mm-ddThh:mm`; the popup is engine-dependent         |
| Telephone entry       | `type="tel"`            | Validates nothing — keypad and autofill semantics only; see below  |
| Number                | `type="number"`         | With `min` and `step` for the variants below                       |

### Numeric Variants

The five numeric formats a form usually wants are combinations of `type="number"` with `min` and `step`; no `data-fs-*` attribute is involved.

| Format               | Markup                           |
|----------------------|----------------------------------|
| Number               | `type="number"`                  |
| Non-negative number  | `type="number" min="0"`          |
| Positive number      | `type="number" min="0.01"`       |
| Integer              | `type="number" step="1"`         |
| Non-negative integer | `type="number" min="0" step="1"` |
| Positive integer     | `type="number" min="1" step="1"` |

HTML has no exclusive minimum, so a positive number states the smallest value it actually accepts. `min="0.01"` above is an illustration, not a rule; pick the granularity the field needs.

### Native Verdicts

Native constraints report through `ValidityState`. More than one of its flags can be set at once, so the verdict and the code are derived **independently** — the same value can report a `min` code with an `invalid` verdict. Implementations MUST use both rules below.

**The verdict.** It is `valid` when the state is valid. Otherwise it is `invalid` when **any** of `badInput`, `tooLong`, `rangeOverflow`, or `stepMismatch` is set, and `incomplete` otherwise. The rule behind that set: a value that could still become acceptable by appending characters is `incomplete`; a value no continuation can rescue is `invalid`. A too-short string can grow; a too-long one cannot shrink by typing. A value below `min` can climb; one above `max` cannot fall.

**The code.** It is the code of the **first flag set** in the order below. The order is normative — it decides which of several simultaneous failures the person is told about.

| Order | `ValidityState` flag | Code          | Contributes `invalid` |
|-------|----------------------|---------------|-----------------------|
| 1     | `valueMissing`       | `required`    | No                    |
| 2     | `badInput`           | `badinput`    | Yes                   |
| 3     | `typeMismatch`       | `type.native` | No                    |
| 4     | `patternMismatch`    | `pattern`     | No                    |
| 5     | `tooShort`           | `minlength`   | No                    |
| 6     | `tooLong`            | `maxlength`   | Yes                   |
| 7     | `rangeUnderflow`     | `min`         | No                    |
| 8     | `rangeOverflow`      | `max`         | Yes                   |
| 9     | `stepMismatch`       | `step`        | Yes                   |

The two rules diverge whenever a low-ordered flag that does not contribute `invalid` is set alongside a high-ordered one that does. Worked example, pinned here as a vector would pin it:

```
<input type="number" min="5" step="2" value="4">
	rangeUnderflow: true   (4 is below min)
	stepMismatch:   true   (the step base is 5, so 5, 7, 9 … are allowed; 4 is not)

	code    = min        — rangeUnderflow is order 7, stepMismatch is order 9
	verdict = invalid    — stepMismatch is in the invalid set
```

Reading the code off the table's first column and the verdict off the same row would give `incomplete`, which is wrong: no character appended to `4` produces an allowed value.

A field's native constraints are read from its **first control**. On a radio group this costs nothing: the platform raises `valueMissing` on every radio in a group when any of them is `required`. On a checkbox set it matters — `required` binds to the one checkbox carrying it, so an author who wants a checkbox set required MUST place `required` on its first member, or reach for `data-fs-min-selected="1"`, which is set-aware.

### Re-Deriving Native Constraints Without a Browser

A server parser has no `ValidityState` and MUST re-derive the flags from the attributes. The two rules above then apply unchanged. Three details decide whether the re-derivation agrees with a browser.

**Emptiness is `required`'s business alone.** An empty value MUST NOT raise `patternMismatch`, `tooShort`, `tooLong`, `rangeUnderflow`, `rangeOverflow`, or `stepMismatch`. Only `valueMissing` speaks to an empty value. This is the same exemption the `data-fs-*` rules carry, and it is what lets an optional constrained field stay optional: a blank `pattern`-bearing input is valid, not malformed. A server that skips this check will reject every untouched optional field on the form.

**`step` measures divisibility from a base, not from zero.** The step base is `min` when `min` is present, and `0` otherwise — for a `date` control with no `min`, the base is the epoch. A value violates `step` when the difference between it and the base is not an integer multiple of the step. The step attribute's default when absent is `1` for `type="number"` and one day for `type="date"`; `step="any"` disables the check entirely. So `min="5" step="2"` allows 5, 7, 9 and rejects 4 and 6 — reading the step as divisibility by two alone would wrongly accept 6.

**`pattern` is anchored and matches the whole string.** The attribute's value is an unanchored ECMAScript regular expression that the platform compiles with the `v` flag and applies as if wrapped in `^(?:` … `)$`. A server MUST anchor it the same way, MUST NOT apply implicit case-insensitivity or multiline semantics, and MUST treat a value as matching only when the match spans the entire string. A server whose regex engine cannot offer `v`-flag semantics SHOULD compile with the closest available Unicode mode and treat any pattern it cannot compile as an authoring error rather than as a silent pass.

Beyond those three, the mapping is mechanical: emptiness against `required`, string length in UTF-16 code units against `minlength` and `maxlength`, and numeric or chronological order against `min` and `max`.

## Field Types

`data-fs-type` names formats HTML cannot express. Its value is exactly one type name from the table below. A type check never fires on an empty value: emptiness is `required`'s business.

`data-fs-type-param` carries a type's parameter. Only `credit-card` reads one today. FormSanity v1's colon-delimited syntax (`data-type="credit-card:Visa"`) is gone; the parameter is its own attribute.

A typed field MAY carry a native `list` attribute pointing at a `<datalist>` of suggested values — the suggestions are the author's, the validation stays the type's, and an engine treats the datalist as inert markup. This is the blessed pattern for guided entry where no native picker exists; `duration` is the canonical case.

A phone-validated field SHOULD use `type="tel"` as its element type — `tel` defines no format of its own (HTML deliberately leaves phone formats open), so it composes with `us-phone` or `international-phone` rather than replacing them: the element type buys the telephone keypad and autofill semantics, the `data-fs-type` buys the validation. Pairing it with `autocomplete="tel"` completes the autofill story.

```html
<input id="card" name="card" type="text" data-fs-type="credit-card" data-fs-type-param="Visa|MasterCard">
```

A violation's code is `type.` followed by the type name — `type.email`, `type.credit-card`, and so on. A type name outside the table below is an authoring error: an implementation MUST report it rather than silently accept the field.

### Pattern Types

Each of these types is defined by two regular expressions: `full` matches a complete, valid value; `prefix` matches a value that could still become valid by appending characters. A value matching `full` is `valid`; otherwise a value matching `prefix` is `incomplete`; otherwise it is `invalid`. This table is normative.

| Type            | `full`                                     | `prefix`                                |
|-----------------|--------------------------------------------|-----------------------------------------|
| `alpha`         | `/^[A-Za-z]+$/`                            | `/^[A-Za-z]*$/`                         |
| `alphanum`      | `/^[A-Za-z0-9]+$/`                         | `/^[A-Za-z0-9]*$/`                      |
| `identifier`    | `/^[A-Za-z0-9_-]+$/`                       | `/^[A-Za-z0-9_-]*$/`                    |
| `no-whitespace` | `/^\S+$/`                                  | `/^\S*$/`                               |
| `email`         | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`          | `/^[^\s@]+(@[^\s@]*)?$/`                |
| `cvv`           | `/^\d{3,4}$/`                              | `/^\d{0,4}$/`                           |
| `ssn`           | `/^\d{3}-\d{2}-\d{4}$/`                    | `/^\d{0,3}(-\d{0,2}(-\d{0,4})?)?$/`     |
| `duration`      | `/^\d{1,3}:[0-5]\d$/`                      | `/^\d{0,3}(:([0-5]\d?)?)?$/`            |
| `us-dollar`     | `/^\$?(\d+\|\d{1,3}(,\d{3})+)(\.\d{2})?$/` | `/^\$?\d{0,3}(,\d{0,3})*(\.\d{0,2})?$/` |
| `zip`           | `/^\d{5}(-\d{4})?$/`                       | `/^\d{0,5}(-\d{0,4})?$/`                |

A `|` inside a pattern cell is written `\|` so the table's own pipes stay unambiguous; the real expressions use plain `|` alternation. The `i` flag means the expression is case-insensitive.

### `email` and `type="email"`

Both registers can check an email address, and they disagree on purpose.

Native `type="email"` follows HTML's definition, which accepts a bare host with no dot: `jans@websanity` is a conforming value. `data-fs-type="email"` additionally requires a dot and a top-level label of at least two characters, so `jans@websanity` is `incomplete` and `jans@websanity.com` is `valid`.

Use `type="email"` when the platform's definition is what you want — including the mobile keyboard and the no-JavaScript validation floor it brings. Use `data-fs-type="email"` when the form collects deliverable addresses on the public internet and a bare host is a typo. The two MAY be combined on one control; the field's verdict is then the worse of the two checks, and the native check reports first.

### Algorithmic Types

The remaining types are defined by procedure rather than by a pattern.

**`ipv4`.** Reject as `invalid` any value containing a character outside `[0-9.]`, or splitting on `.` into more than four parts. Every part but the last MUST be non-empty, at most three characters, and numerically at most 255; a part failing any of those is `invalid`. The last part MUST be at most three characters, and at most 255 if non-empty. The value is `valid` when it has exactly four parts and the last is non-empty; otherwise `incomplete`.

**`ipv6`.** Reject as `invalid` any value containing a character outside `[0-9A-Fa-f:]`, or containing `::` more than once. Replace the first `::` with `:x:`, split on `:`, and discard empty parts; `x` marks the elision. Any real group longer than four characters is `invalid`, as is a count of real groups above eight. The value is complete when it elides and holds at most seven real groups, or does not elide and holds exactly eight. A complete value not ending in `:` is `valid`; anything else is `incomplete`.

**`ip`.** Run both `ipv4` and `ipv6` and return the better verdict, ranking `valid` above `incomplete` above `invalid`.

**`email-list`.** Split the value on runs of whitespace and commas and discard empty items. Validate each item as `email`. An item that comes back `incomplete` and is _not_ the last item becomes `invalid` — the author moved past it, so it is finished and wrong. The list's verdict is the worst item's verdict; an empty list is `valid`.

**`credit-card`.** Strip spaces and hyphens. A remaining non-digit makes the value `invalid`. Read the allowed network list from `data-fs-type-param`, splitting on `|`; an absent parameter means `Visa|MasterCard|Amex|Discover`, and an unrecognized name is ignored. Determine the candidate networks, then: no candidates means `invalid`; more digits than the longest length any candidate accepts means `invalid`; a digit count equal to an accepted length of some candidate hands the decision to the Luhn checksum, passing `valid` and failing `invalid`; anything else is `incomplete`.

Candidacy is the subtle part. **A network is a candidate only once its full issuer prefix has been entered.** Below two digits, every allowed network is a candidate, because one digit cannot yet disqualify a two-digit prefix. From two digits on, a network is a candidate only if the value actually starts with one of its prefixes — a partially typed prefix does not keep it alive. With `Discover` as the only allowed network, `6` is `incomplete` (still under two digits), while `60` and `601` are both `invalid`: neither has reached `6011` or `65`, and no other network can rescue them. This is deliberate. It fails a doomed number as early as the prefix proves it doomed, rather than letting the person type fifteen more digits first.

| Network      | Issuer prefix        | Accepted lengths |
|--------------|----------------------|------------------|
| `Visa`       | `4`                  | 13, 16, 19       |
| `MasterCard` | `51`–`55`, `22`–`27` | 16               |
| `Amex`       | `34`, `37`           | 15               |
| `Discover`   | `6011`, `65`         | 16, 17, 18, 19   |

A number that reaches an accepted length and fails Luhn is a **dead end**, not a work in progress. Appending a digit can only make it a different length, which is either another accepted length (checked again on its own merits) or past the maximum. This is the one place a type check calls a value `invalid` on arithmetic rather than on shape.

The Luhn checksum: walking the digits right to left, double every second digit, subtracting 9 from any doubled result above 9, and sum. The number passes when the sum is divisible by ten.

**`us-phone`.** Any character outside `[0-9() .-]` makes the value `invalid`, as does a digit count above ten. Exactly ten digits arranged to match `/^\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}$/` is `valid`. Anything else is `incomplete`.

**`international-phone`.** The value MUST begin with `+`; if it does not, or if any character after the `+` falls outside `[0-9() .-]`, it is `invalid`. More than fifteen digits is `invalid`. Seven or more digits is `valid`; fewer is `incomplete`.

## Three-State Validation

Every check yields one of three verdicts.

| Verdict      | Meaning                                                           | Example                                            |
|--------------|-------------------------------------------------------------------|----------------------------------------------------|
| `valid`      | The value satisfies the rule                                      | `jans@websanity.com` for `email`                   |
| `incomplete` | Appending characters could make it valid — the **appending rule** | `jans@web` for `email`, `192.168.` for `ipv4`      |
| `invalid`    | A dead end no continuation can fix                                | `jans@web@x` for `email`, `192.168.1-1` for `ipv4` |

The appending rule is the whole test. Ask whether _some_ string of characters, appended to this value, produces a valid one. If yes, the verdict is `incomplete`. If no, it is `invalid`. Deleting, inserting in the middle, and retyping do not count — only appending, because that is what a person typing forward can do next.

### Merging Verdicts

A field's verdict is the **worst** verdict among every check that applies to it, ranking `invalid` worse than `incomplete` worse than `valid`. The reported code and message belong to the first check that produced that worst verdict, in this order: native constraints, then the `data-fs-type` check, then each `data-fs-*` rule in document order, then group membership.

The type check is skipped when the native constraints have already returned `invalid`, and when the value is empty.

### Timing

Timing is a client-engine obligation; a server sees only the final state.

- An `invalid` verdict presents immediately, on `input`. A letter in a number field is wrong the moment it is typed.
- An `incomplete` verdict presents on blur, so a half-typed email address draws no complaint. The requiredness codes — `required`, `group.at-least-one`, `group.all-or-none`, and `min-selected` — are the exception: they mean "not answered yet" rather than "answered wrong", the asterisk indicator and the form-level status line already say so, and they never present a bubble on their own. A submit attempt still reveals them as messages.
- Once a field has presented an error, it re-validates on every `input`, so the error clears the moment the value is fixed.
- A submit attempt presents every outstanding error and moves focus to the first non-valid field.
- `data-fs-unique-in-page` is checked on blur only; a transient collision mid-typing is not an error.

### Submit-Time Collapse

At submit time `incomplete` collapses into `invalid`. A submission is offered only when every relevant field is `valid`, so the server and the protocol see two states, not three. Error codes carried in the response envelope are the same codes this document defines.

## Rules

Every rule attribute below is authored on a control. Unless the Document Grammar says otherwise, an implementation reads it from the field's first control. Each entry gives the attribute's value syntax, its semantics, the verdict a violation produces, and the code it reports.

### Comparison Rules

| Attribute                    | Value          | Violated when                                | Verdict                                                                 | Code                 |
|------------------------------|----------------|----------------------------------------------|-------------------------------------------------------------------------|----------------------|
| `data-fs-equals`             | A literal      | The value differs from the literal           | `incomplete` while the value is a prefix of the literal, else `invalid` | `equals`             |
| `data-fs-not-equals`         | A literal      | The value equals the literal                 | `incomplete`                                                            | `not-equals`         |
| `data-fs-equals-field`       | A field `name` | The value differs from that field's value    | `incomplete` while the value is a prefix of it, else `invalid`          | `equals-field`       |
| `data-fs-not-equals-field`   | A field `name` | The value equals that field's value          | `incomplete`                                                            | `not-equals-field`   |
| `data-fs-greater-than-field` | A field `name` | The value does not exceed that field's value | `incomplete`                                                            | `greater-than-field` |
| `data-fs-less-than-field`    | A field `name` | The value is not below that field's value    | `incomplete`                                                            | `less-than-field`    |

An empty value never violates a comparison rule; emptiness is `required`'s business. A comparison against an empty _other_ field is likewise skipped for the ordering rules — but not for `data-fs-equals-field`, where an empty target with a non-empty value is a dead end and reports `invalid`.

The two ordering rules compare **chronologically** when either operand is a date-typed field, and **numerically** otherwise. A field is date-typed when its control is `type="date"`. When either operand fails to parse as the chosen kind, the rule reports no violation — an implementation MUST NOT invent a verdict from an unparseable operand. A chronological violation reports the code with a `.date` suffix (`greater-than-field.date`, `less-than-field.date`) so the message can say _after_ rather than _greater than_.

```html
<li>
	<label for="password-confirm">Confirm password</label>
	<input id="password-confirm" name="password-confirm" type="password" data-fs-equals-field="password">
</li>
```

### Password Composition

These three count character classes, replacing v1's `data-min-length-digit` family, which read as length constraints but were not.

| Attribute               | Value              | Semantics                                | Verdict      | Code            |
|-------------------------|--------------------|------------------------------------------|--------------|-----------------|
| `data-fs-min-digits`    | A positive integer | At least _n_ characters matching `[0-9]` | `incomplete` | `min-digits`    |
| `data-fs-min-uppercase` | A positive integer | At least _n_ characters matching `[A-Z]` | `incomplete` | `min-uppercase` |
| `data-fs-min-lowercase` | A positive integer | At least _n_ characters matching `[a-z]` | `incomplete` | `min-lowercase` |

An empty value never violates a composition rule. All three are `incomplete` on violation, because typing more characters can always satisfy them.

### Groups

A group is named, and its members are the fields carrying the same attribute with the same name. Every member reports the group's verdict.

| Attribute                    | Value        | Semantics                                       | Verdict      | Code                 |
|------------------------------|--------------|-------------------------------------------------|--------------|----------------------|
| `data-fs-group-at-least-one` | A group name | At least one member MUST hold a non-empty value | `incomplete` | `group.at-least-one` |
| `data-fs-group-all-or-none`  | A group name | Either every member holds a value or none does  | `incomplete` | `group.all-or-none`  |

When an at-least-one group is entirely empty, **every** member reports `group.at-least-one`. When an all-or-none group is partly filled, **each empty** member reports `group.all-or-none`; a filled member is satisfied. Neither rule fires on a wholly empty all-or-none group.

```html
<li>
	<label for="home-phone">Home phone</label>
	<input id="home-phone" name="home-phone" type="text" data-fs-type="us-phone" data-fs-group-at-least-one="phone">
</li>
<li>
	<label for="mobile-phone">Mobile phone</label>
	<input id="mobile-phone" name="mobile-phone" type="text" data-fs-type="us-phone" data-fs-group-at-least-one="phone">
</li>
```

A field's value for group purposes is its control's value; for a choice group it is the checked members' values joined with commas, so a set with nothing checked counts as empty.

### Selection Counts

These bound a choice group or a `select[multiple]` list — on a list, the count is its selected options. Either MAY sit on any member of the set (or on the `select` itself).

| Attribute              | Value                  | Semantics                    | Verdict      | Code           |
|------------------------|------------------------|------------------------------|--------------|----------------|
| `data-fs-min-selected` | A non-negative integer | At least _n_ members checked | `incomplete` | `min-selected` |
| `data-fs-max-selected` | A positive integer     | At most _n_ members checked  | `invalid`    | `max-selected` |

The asymmetry is the appending rule at work: too few boxes can still be fixed by checking more, so it is `incomplete`; too many is a state the person has to undo, so it is `invalid`.

### Uniqueness

Two different rules, one word.

`data-fs-unique-in-page="name"` requires the values of its members — every field carrying the attribute with the same name — to be mutually distinct within the form. A duplicate reports `invalid` with the code `unique-in-page`. Empty values never collide. A client engine MUST check this on blur only.

`data-fs-unique="url"` invokes the server-checked uniqueness sub-protocol, defined in `submission-protocol.md`. The attribute's value is the check endpoint. A duplicate reports `invalid` with the code `unique`. The interactive check is advisory: the server's check at submission is authoritative, and a rate-limited or failed check MUST NOT mark the field invalid.

### Files

`data-fs-max-file-size` caps upload size. Its value is a size in the grammar below.

| Attribute               | Value  | Semantics                      | Verdict   | Code            |
|-------------------------|--------|--------------------------------|-----------|-----------------|
| `data-fs-max-file-size` | A size | No selected file may exceed it | `invalid` | `file.max-size` |

Extension filtering is native `accept`, and it is **advisory**. The browser uses it to filter the file picker, but a person can defeat that filter, and `accept` raises no `ValidityState` flag — so the reference client never rejects a field on it and reports no code. A server MAY enforce `accept` against the submitted file's name and media type, reporting the code `file.accept`. A server that stores uploads SHOULD do exactly that: `accept` is the only file-type constraint the vocabulary carries, and nothing else checks it.

The size grammar is a number followed by a unit, matching `/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i` after trimming surrounding whitespace. The number MAY carry a decimal fraction. The unit is case-insensitive and MAY be preceded by a space. Units are binary multiples of 1024: `b` is 1, `kb` is 1024, `mb` is 1048576, `gb` is 1073741824. `2MB`, `2mb`, `2 MB`, `1.5MB`, and `500b` are all well-formed; `2 gigs` is not, and an implementation MUST report an authoring error rather than guess.

```html
<li>
	<label for="attachment">Attachment</label>
	<input id="attachment" name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">
</li>
```

### Code Reference

Every code an implementation can report, whether from markup or from a server's response envelope.

| Code                                               | Source                                            | Violation verdict                                            |
|----------------------------------------------------|---------------------------------------------------|--------------------------------------------------------------|
| `required`                                         | native `required`, value empty                    | `incomplete`                                                 |
| `type.<name>`                                      | `data-fs-type`                                    | `incomplete` or `invalid` per the three-state check          |
| `type.native`                                      | native `typeMismatch`                             | `incomplete`                                                 |
| `badinput`                                         | native `badInput`                                 | `invalid`                                                    |
| `pattern`                                          | native `pattern`                                  | `incomplete`                                                 |
| `minlength` / `maxlength`                          | native                                            | `incomplete` / `invalid`                                     |
| `min` / `max` / `step`                             | native                                            | `incomplete` / `invalid` / `invalid`                         |
| `equals` / `equals-field`                          | value must equal literal / other field            | `invalid` when not a prefix of the target, else `incomplete` |
| `not-equals` / `not-equals-field`                  | value must differ                                 | `incomplete`                                                 |
| `greater-than-field` / `less-than-field`           | numeric ordering                                  | `incomplete`                                                 |
| `greater-than-field.date` / `less-than-field.date` | chronological ordering                            | `incomplete`                                                 |
| `min-digits` / `min-uppercase` / `min-lowercase`   | password composition                              | `incomplete`                                                 |
| `group.at-least-one` / `group.all-or-none`         | group membership                                  | `incomplete`                                                 |
| `min-selected` / `max-selected`                    | choice-group counts                               | `incomplete` / `invalid`                                     |
| `file.max-size`                                    | `data-fs-max-file-size`                           | `invalid`                                                    |
| `file.accept`                                      | native `accept`                                   | server-optional; never raised by the client                  |
| `unique` / `unique-in-page`                        | server check / page check                         | `invalid`                                                    |
| `relevance`                                        | a non-empty value arrived for an irrelevant field | server-side only                                             |

Codes are stable identifiers, not messages. A client maps any server rejection back to a rule and a field without parsing prose.

This table is the closed set for version 2, and the prefix `x-` is reserved for a server's own codes so that no extension collides with a future addition to it; `submission-protocol.md` defines how one travels.

## Relevance

_Relevance_ is FormSanity's word for conditional logic — the concept XForms named `relevant`. It unifies v1's `data-display` and `data-enable`, which were one idea wearing two presentations.

| Attribute            | Value                  | Semantics                                                            |
|----------------------|------------------------|----------------------------------------------------------------------|
| `data-fs-relevant`   | An expression          | The field participates in the form only while the expression is true |
| `data-fs-irrelevant` | `hidden` \| `disabled` | How an irrelevant field presents; defaults to `hidden`               |

```html
<li>
	<label for="color">Favorite color</label>
	<select id="color" name="color">
		<option value="">Select a color</option>
		<option value="Red">Red</option>
		<option value="Other">Other</option>
	</select>
</li>
<li>
	<label for="other-color">Which color?</label>
	<input id="other-color" name="other-color" type="text" required data-fs-relevant="color == 'Other'">
</li>
```

An irrelevant field:

- MUST NOT be validated. Its rules are inert and it contributes nothing to the form's overall verdict.
- MUST NOT be submitted. Its name does not appear in the payload.
- MUST have every one of its controls disabled, in both modes. Disabling is what keeps the value out of a native submission and out of the tab order.
- MUST, in `hidden` mode, have its row hidden and marked as irrelevant. In `disabled` mode the row stays in place, visibly inactive.

A field with no row — a choice group of two or more members, per the Row Resolution rule — has no box to hide. In `hidden` mode such a field is disabled but stays in place, which is `disabled` mode's presentation. A lone checkbox is a one-control field and hides normally; only sets are affected. Authors who need a whole choice group to vanish SHOULD say so with `data-fs-irrelevant="disabled"` rather than expect `hidden` to do it.

### Reaching Across a Relevance Boundary

An irrelevant field's own rules are inert, but its value stays in the DOM and other fields can still name it — in a cross-field comparison, in a group, in another relevance expression. That is where a client and a server part company: the client reads the value still sitting in the hidden control, while the server sees a field that never arrived.

The vocabulary closes the gap by forbidding the construction rather than by picking a winner. **A rule MUST NOT reference a field that can become irrelevant, and every member of a group MUST share the same relevance condition.** A form violating that constraint has undefined behavior, and the two implementations are allowed to disagree about it.

### The Server Obligation

Relevance is normative, not decorative. **A server parser MUST treat a submitted value for an irrelevant field as a validation failure**, reporting the code `relevance` for that field. Otherwise relevance is a suggestion a hostile client ignores, and every rule guarded by it becomes optional.

Only a **non-empty** value triggers the rejection. An empty submitted value for an irrelevant field is treated exactly as an absent one, because the two are indistinguishable in intent and several ordinary paths produce the empty form: a client that gathers before relevance settles, a `multipart/form-data` body carrying an empty part, or a proxy that normalizes missing keys. Rejecting those would fail honest submissions to catch nothing — an empty value asserts no answer.

Evaluating relevance server-side means evaluating the same expression against the submitted payload. A field absent from the payload reads as the empty string, which is exactly how the client reads an unanswered field.

### Values in Expressions

An expression reads a field's current value as a string.

- A text, number, date, or `select` field reads as its value; an unanswered one reads as `''`.
- A checked checkbox reads as its `value` attribute. An unchecked one reads as `''`. This is why `ship == 'on'` is the idiomatic test for a lone checkbox declared `value="on"`.
- A choice group reads as its checked members' values joined with commas, in document order. A `select[multiple]` reads the same way: its selected options' values, comma-joined.

Chained relevance — a condition naming a field that can itself become irrelevant — falls under the constraint above and MUST be avoided. Write each condition against unconditionally relevant fields, repeating a clause where a nested condition is tempting.

## Expression Grammar

One grammar serves `data-fs-relevant` and any future expression attribute.

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

Whitespace between tokens is insignificant. The grammar has no functions; one gets added when a real form needs it.

### Operands

A bare `name` reads the named field's value, per the rules just above; an unknown or unanswered name reads as `''`.

A `string` is single-quoted. A literal single quote is written as two: `'O''Brien'` is the four-character value `O'Brien`. Double quotes have no meaning in the grammar — they are ordinary characters inside a string, and a syntax error outside one. Since expressions live in HTML attributes, authors SHOULD delimit the attribute with double quotes so single quotes need no escaping.

A `number` is a decimal literal, optionally negative. A numeric literal normalizes as a number and then stringifies, so `qty == 3`, `qty == 3.0`, and `qty == '3'` all test the value `'3'`.

### Operators

`==` and `!=` compare as **strings**, after both operands stringify. There is no numeric coercion and no type juggling: `'3'` and `'3.0'` are different values.

`<`, `<=`, `>`, and `>=` compare **chronologically** when either operand is a date-typed field, and **numerically** otherwise. A comparison MUST evaluate to false when either operand is empty or blank, and when either operand fails to parse as the chosen kind. This makes `qty > 3` false for an unanswered `qty` rather than an error.

A comparison takes exactly one operator and does not chain: `a < b < c` is a syntax error, not a nested comparison.

`!`, `&&`, and `||` are the boolean operators. `||` binds loosest, then `&&`, then `!` — and a comparison binds tighter than all three. Read `!` off the grammar rather than off habit: because `unary` recurses into `primary`, which swallows a whole comparison, `!answer == 'yes'` negates the comparison, not the operand. Write `!(answer == 'yes')` when that is what you mean, and parenthesize whenever it is not obvious. `&&` and `||` MAY short-circuit; the grammar has no side effects, so it does not matter.

A bare operand used where a boolean is expected is **truthy when its string value is non-empty**. `color` alone means _color was answered_; `color != ''` says the same thing more plainly and SHOULD be preferred.

`===` is not an operator and MUST be reported as a syntax error, as MUST a single `=`, an unterminated string, unbalanced parentheses, and any trailing input after a complete expression.

### Vector File Format

`vectors/expressions.json` is an array of objects. Each is one conformance case.

```json
[
	{ "expr": "color != ''", "fields": { "color": "red" }, "expected": true },
	{ "expr": "start < end", "fields": { "start": "2026-01-02", "end": "2026-02-01" }, "types": { "start": "date", "end": "date" }, "expected": true },
	{ "expr": "name == 'O''Brien'", "fields": { "name": "O'Brien" }, "expected": true }
]
```

An implementation passes when, for every entry, parsing `expr` and evaluating it against `fields` (with `types` marking date-typed names) yields `expected`.

## Behaviors

Behaviors are browser conveniences. **A server parser MUST ignore every attribute in this section.** None of them affects whether a submission is acceptable, and a server that acts on one is misreading the form.

A client engine MUST make a programmatic value change indistinguishable from a typed one: after writing a value into a control, it dispatches a bubbling `input` event, so validation, dependent fields, other behaviors, and the submit gate all react as they would to the person.

| Attribute                    | Host                     | Value                        | Behavior                                                         |
|------------------------------|--------------------------|------------------------------|------------------------------------------------------------------|
| `data-fs-copy-to`            | Any control              | A field `name`               | Mirrors this control's value onto the named field on every input |
| `data-fs-amount`             | Any control              | None                         | Marks the control as a term in the form's total                  |
| `data-fs-amount-total`       | Any element              | None                         | Receives the sum of every `data-fs-amount` control in the form   |
| `data-fs-year-options`       | `select`                 | `from,to`                    | Generates year options offset from the current year              |
| `data-fs-month-options`      | `select`                 | `from,to`                    | Generates month options offset from the current calendar month   |
| `data-fs-prefix`             | Any control              | Text                         | Renders an informational cap before the control                  |
| `data-fs-suffix`             | Any control              | Text                         | Renders an informational cap after the control                   |
| `data-fs-reveal`             | `input[type="password"]` | None                         | Adds the engine's show/hide toggle                               |
| `data-fs-when-valid`         | Any element              | `hide` \| `show` \| `enable` | Reacts to the form's overall validity                            |
| `data-fs-no-gate`            | `form`                   | None                         | Opts the form out of default submit gating                       |
| `data-fs-message-incomplete` | `form`                   | Text                         | Overrides the status region's incomplete line                    |
| `data-fs-message-invalid`    | `form`                   | Text                         | Overrides the status region's invalid line                       |
| `data-fs-label`              | Any control              | Text                         | Names the field in messages                                      |
| `data-fs-error-to`           | Any control              | A CSS selector               | Redirects the field's error bubble                               |

### Copy To

`data-fs-copy-to="target"` mirrors the source control's value onto the first control of the field named `target`, on every input. A chain propagates in full: A into B into C. A cycle collapses to a single hop, because a write is skipped once the target already holds the value being written. The target SHOULD be a text-like control; mirroring into a checkbox or radio set is undefined.

### Amount Totals

`data-fs-amount` marks a control as a term. `data-fs-amount-total` marks an element as a destination. Totals are **form-wide**: every marked control in the form sums into every marked destination, once at init and again on every input. A term's value is read with `$` and `,` stripped; a value that does not parse as a number contributes zero. The sum renders with exactly two decimal places.

A destination that is itself a form control receives the sum as its `value` — and, being a value change, dispatches `input` — so a total can be submitted. Any other element receives the sum as its text.

```html
<li>
	<label for="donation">Donation</label>
	<input id="donation" name="donation" type="text" data-fs-amount>
</li>
<li>
	<span>Total</span>
	<output id="total" data-fs-amount-total></output>
</li>
```

### Generated Date Options

Both attributes take two integer offsets, `from,to`, with `from` at or below `to`. Options are generated once at initialization and **appended after** any static options already present, so an author's placeholder stays first.

`data-fs-year-options` offsets whole years from the current year. Each option's value and label are the four-digit year: `"0,5"` in 2026 yields 2026 through 2031.

`data-fs-month-options` offsets whole months from the current calendar month, not from the start of the year. Each option's value is the resulting calendar month number, 1 through 12, and its label is `MM - Mon` — `08 - Aug`. A `select` carries no year, so an offset run crossing a year boundary simply wraps: `"0,11"` always yields exactly the twelve calendar months starting at the current one, in order, once each. This **rolling twelve-month window** is deliberate and differs from a calendar-year list.

### Password Reveal

`data-fs-reveal` on a password input appends a `button.fs-reveal` after the control, rendered as an accent cap bearing v1's visibility eye glyph. Activating it toggles the control between `type="password"` and `type="text"`, and the button reflects its state through its `aria-label` ("Show password" / "Hide password"), `aria-pressed`, and the glyph (open eye / slashed eye). This replaces v1's `data-type="password"` opt-in, renamed to say what it does.

### Caps

`data-fs-prefix` and `data-fs-suffix` on a control render its value as a cap fused to the control's box — an informational bookend such as a currency mark or a unit, in v1's fused-cap visual language. The engine wraps the control in a `span.fs-caps` flex wrapper holding `span.fs-prefix` and `span.fs-suffix` elements as declared; the wrapper takes over the control's border and background, and a `data-fs-reveal` button renders inside the same wrapper as an interactive suffix cap. Caps are presentation only: they never touch the control's value or the submitted payload, and the cap text is not associated with the control for assistive technology — meaning that matters belongs in the label or an annotation.

File inputs are capped automatically: a file control with no `data-fs-suffix` of its own gets a "Choose file…" suffix cap in the accent color, the native file-selector button is hidden, and the cap (marked `aria-hidden`, since the input itself remains the accessible control) forwards its clicks to the input. An explicit `data-fs-suffix` on a file input replaces the automatic cap, text and all. The engine also mirrors the control's selection state as an `fs-has-file` class on the wrapper, which the stylesheet uses to gray the browser's no-file text like a placeholder while a chosen filename keeps normal ink.

Date and time inputs are capped the same way: a `date`, `time`, or `datetime-local` control with no `data-fs-suffix` gets a glyph suffix cap (`fs-picker-date` / `fs-picker-time` / `fs-picker-datetime-local`; v1's calendar and clock artwork, and a combined calendar-clock for `datetime-local`) in the accent scheme — interactive caps wear the accent color like the file cap, informational caps stay gray — that calls the control's `showPicker()` on activation, falling back to focusing the control where the engine has no popup for the type. The cap is `aria-hidden` — the input remains the accessible control — and the browser's own picker indicator is suppressed inside a caps wrapper so the field carries one glyph, not two.

### Deselection

The engine makes two native controls deselectable, with no opt-in attribute. Clicking a checked radio unchecks it, returning its group to unanswered — Space on a focused checked radio does the same, and arrow-key selection is untouched. Clicking the only selected item in a `select[multiple]` list clears the list; modified clicks (Ctrl, Cmd, Shift) keep their native meanings. Both are client-only affordances: the wire formats are unchanged, and a deselected group simply submits as unanswered.

### Format Hints

A control with a `data-fs-type` and no authored `placeholder` gets its type's format hint as a placeholder — `zip` gains `##### or #####-####`, `us-dollar` gains `###.##`, and so on for the format-shaped types (`cvv`, `us-phone`, `international-phone`, `ssn`, `duration`). Types whose nature is a description rather than a shape have no hint, and an authored `placeholder` always wins. The hint table ships beside the message catalog and is replaceable the same way.

### Character Counter

Any control carrying `maxlength` gets a live characters-remaining counter, without an opt-in attribute. The engine inserts a `small.fs-counter` immediately after the control and updates it on input. `maxlength` is a native constraint; the counter is the behavior that rides along.

### When Valid

`data-fs-when-valid` makes any element react to the form's overall validity — true when no relevant field is `incomplete` or `invalid`. It generalizes v1's `data-all-are-valid`.

| Value    | Effect                                              |
|----------|-----------------------------------------------------|
| `hide`   | The element is hidden while the form is valid       |
| `show`   | The element is shown only while the form is valid   |
| `enable` | The element is enabled only while the form is valid |

`hide` is v1's readiness-message pattern: a "please finish the form" note that disappears once the form is ready.

The common cases need no markup. By default the engine disables the submit button until the form validates and renders its own status messages; `data-fs-no-gate` on the form opts out of the button gating, inverting v1's `data-ignore-all-valid` into an opt-out. It opts out of the _disabled button_ and nothing else: a submission with outstanding errors is still refused, every error presents, and focus moves to the first offender.

### Message Attributes

`data-fs-label` names a field in its messages. Absent it, an implementation falls back to the text of the `label` associated with the control by `for`, then to the first `label` in the field's row, then to the field's `name`. Only a real `label` element enters the chain, so a row labelled by a `span` — a compound row — needs `data-fs-label` to avoid landing on the raw `name`.

`data-fs-error-to` moves a field's error bubble. Its value is a CSS selector resolved within the form. The bubble is a `p`, so the target **MUST be a flow container that may contain a paragraph** — a `div`, not a `p`. When the selector matches nothing, the bubble falls back to the field's row.

`data-fs-message-incomplete` and `data-fs-message-invalid` on the form override the two standing status lines.

## Presentation Contract

A client engine owns error presentation. This section fixes the DOM it writes and the classes it toggles, so site CSS and site scripts can rely on them. Nothing here concerns a server parser.

### Form-Level Marks

At initialization the engine sets `novalidate` on the form — it presents errors itself — and adds the class `fs-form`, which is what scopes the shipped stylesheet to forms it has taken over. While every relevant field is valid the form also carries `fs-all-valid`.

### Error Bubbles

A field's message renders as a `p.fs-error` carrying `data-fs-field="<name>"` and a unique `id`. The engine appends it inside the `data-fs-error-to` target when one resolves, otherwise inside the field's row, and otherwise — for a field with no row — inside the closest ancestor `fieldset`. The name on the bubble is what keeps two fields sharing one row from overwriting each other's messages.

The control the message is about receives `aria-invalid="true"` and `aria-describedby` pointing at the bubble's `id`. Both are removed when the message clears.

```html
<p class="fs-error" data-fs-field="email" id="fs-error-1">must be an email address</p>
```

### Row Classes

The engine toggles exactly one of three classes on a field's row — or on the fallback `fieldset` — to match the field's verdict, plus one more for relevance.

| Class           | Meaning                                           |
|-----------------|---------------------------------------------------|
| `fs-valid`      | The row's fields are all valid                    |
| `fs-incomplete` | The worst verdict on the row is `incomplete`      |
| `fs-invalid`    | The worst verdict on the row is `invalid`         |
| `fs-irrelevant` | The row is hidden because its field is irrelevant |

The not-valid indicator is drawn from `fs-incomplete` and `fs-invalid`: the stylesheet grows an asterisk at the end of the row's label. A required field is not valid while empty, so the asterisk doubles as the required marker and disappears once the field is satisfied — v1's behavior, recoded in CSS.

### Status Region

The engine ensures a `div.fs-status` with `aria-live="polite"` exists, inserting it before the submit control — or before the form's last element child when the form has no submit control. An author MAY place `div.fs-status` anywhere in the form to control where it lands; the engine adopts it rather than adding a second.

The region holds up to four kinds of line, each a `p`.

| Element                  | Purpose                                                       |
|--------------------------|---------------------------------------------------------------|
| `p.fs-status-incomplete` | Standing line, shown while any relevant field is `incomplete` |
| `p.fs-status-invalid`    | Standing line, shown while any relevant field is `invalid`    |
| `p.fs-status-message`    | The result of a submission: processing, success, or failure   |
| `p.fs-status-error`      | One per form-level error returned by the server               |

Both standing lines can show at once, and each clears as its condition resolves. Their text comes from the message catalog, overridable per form with `data-fs-message-incomplete` and `data-fs-message-invalid`.

The region itself carries one submission-state class at a time.

| Class           | State                                   |
|-----------------|-----------------------------------------|
| `fs-processing` | A submission is in flight               |
| `fs-success`    | The server accepted the submission      |
| `fs-error`      | The submission failed or was unreadable |

Because the region takes an `fs-error` class of its own, the element name is what tells a form-level banner from a field bubble: a bubble is always `p.fs-error`, the region is always `div.fs-status`.

### Engine-Written Elements

Three more engine-written structures, all covered above: the `span.fs-caps` wrapper (with `span.fs-prefix` / `span.fs-suffix` children) around any capped or reveal-bearing control, `button.fs-reveal` after a `data-fs-reveal` password input, and `small.fs-counter` after any `maxlength` control.

### Theming Knobs

The shipped stylesheet lives in `@layer formsanity`, so unlayered site CSS outranks every rule in it without a specificity fight — the library is framework CSS from a site's point of view. Its custom properties are public API with the same compatibility guarantees as the attributes in this document. Redefine them on the form or on any ancestor.

| Property                       | Default                 | Governs                                            |
|--------------------------------|-------------------------|----------------------------------------------------|
| `--fs-font-family`             | `system-ui, sans-serif` | The form's typeface                                |
| `--fs-font-size`               | `1rem`                  | The form's base size                               |
| `--fs-gap`                     | `0.75rem`               | Spacing between rows and between compound controls |
| `--fs-column-gap`              | `2rem`                  | The gutter between columns in a `cols` group       |
| `--fs-label-gap`               | `0.25em`                | The gap between a left label and its control       |
| `--fs-label-width`             | `max-content`           | The left-label column's track size                 |
| `--fs-control-padding`         | `0.4em 0.5em`           | Padding inside every box-like control              |
| `--fs-border-color`            | `hsl(0 0% 70%)`         | Control and fieldset borders                       |
| `--fs-border-radius`           | `0.25rem`               | Corner rounding throughout                         |
| `--fs-section-bkg`             | `hsl(0 0% 97%)`         | Outer fieldset background and derived border       |
| `--fs-focus-color`             | `hsl(210 80% 55%)`      | The focus ring                                     |
| `--fs-label-color`             | `inherit`               | Row label text                                     |
| `--fs-annotation-color`        | `hsl(0 0% 40%)`         | Annotations, counters, section prose               |
| `--fs-asterisk-color`          | `hsl(0 85% 40%)`        | The not-valid asterisk                             |
| `--fs-asterisk-size`           | `0.5em`                 | The not-valid asterisk's width                     |
| `--fs-error-bkg`               | `hsl(0 85% 40%)`        | Error bubble background                            |
| `--fs-error-color`             | `white`                 | Error bubble text                                  |
| `--fs-status-incomplete-color` | `hsl(0 0% 25%)`         | The standing incomplete line                       |
| `--fs-status-invalid-bkg`      | `hsl(0 85% 40%)`        | Red status banners                                 |
| `--fs-status-invalid-color`    | `white`                 | Red status banner text                             |
| `--fs-disabled-opacity`        | `0.5`                   | Disabled controls and irrelevant rows              |
| `--fs-toggle-accent`           | `hsl(210 80% 42%)`      | Checked toggles and selected buttons               |
| `--fs-toggle-border-color`     | `hsl(0 0% 56%)`         | Unchecked toggle indicator borders                 |
| `--fs-transition-duration`     | `150ms`                 | Color and opacity state changes                    |

### Breakpoints

Two container-query breakpoints govern the layout, and both are fixed lengths rather than knobs: a size query's condition cannot read a custom property.

| Breakpoint | Length  | Effect below it                                   |
|------------|---------|---------------------------------------------------|
| Left label | `32rem` | Labels sit above their controls instead of beside |
| Columns    | `52rem` | A `cols` group collapses to a single column       |

Each breakpoint is decided in exactly one rule, which sets a group of `--_fs-*` **row switches** that the rest of the stylesheet reads. Those two switch groups are the supported override mechanism: an override restates the switch declarations at a new length. The seven switches tabled below are stable and MAY be relied on for that purpose; every other `--_fs-*` property in the stylesheet is internal machinery and may be renamed without notice.

The left-label breakpoint sets these four.

| Switch                 | Narrow value | Wide value                  |
|------------------------|--------------|-----------------------------|
| `--_fs-label-justify`  | `stretch`    | `end`                       |
| `--_fs-label-align`    | `left`       | `right`                     |
| `--_fs-label-pad`      | `0`          | `var(--fs-control-padding)` |
| `--_fs-control-column` | `1`          | `2`                         |

The columns breakpoint sets these three, on the `.cols` group only.

| Switch             | Narrow value | Wide value   |
|--------------------|--------------|--------------|
| `--_fs-row-span`   | `1 / -1`     | `span 2`     |
| `--_fs-column-one` | `1 / -1`     | `1 / span 2` |
| `--_fs-column-two` | `1 / -1`     | `3 / span 2` |

The narrow values are the stylesheet's defaults, declared once on `.fs-form`; a breakpoint rule only ever states the wide set.

Moving a breakpoint means restating its rule on **both** sides of the new length. Both, because the shipped rule still applies at its own length: an override naming only the new one leaves two breakpoints rather than a moved one. To move left labels from `32rem` to `40rem`:

```css
@container fs-group (width < 40rem) {
	.fs-form fieldset:not(.toggle-list) > ul {
		grid-template-columns: minmax(0, 1fr);
		--_fs-label-justify: stretch;
		--_fs-label-align: left;
		--_fs-label-pad: 0;
		--_fs-control-column: 1;
	}
}
@container fs-group (width >= 40rem) {
	.fs-form fieldset:not(.toggle-list) > ul {
		grid-template-columns: var(--fs-label-width) minmax(0, 1fr);
		--_fs-label-justify: end;
		--_fs-label-align: right;
		--_fs-label-pad: var(--fs-control-padding);
		--_fs-control-column: 2;
	}
}
```

Freeform rows carry the same four label switches in a rule of their own; move their breakpoint the same way, with `.fs-form div[data-fs-field]` as the subject and an unnamed `@container`.

The columns breakpoint moves by the same two-sided restatement, naming its own three switches. To move it from `52rem` to `64rem`:

```css
@container fs-group (width < 64rem) {
	.fs-form fieldset:not(.toggle-list) > ul.cols {
		--_fs-row-span: 1 / -1;
		--_fs-column-one: 1 / -1;
		--_fs-column-two: 1 / -1;
	}
}
@container fs-group (width >= 64rem) {
	.fs-form fieldset:not(.toggle-list) > ul.cols {
		grid-template-columns: var(--fs-label-width) minmax(0, 1fr) var(--fs-label-width) minmax(0, 1fr);
		column-gap: var(--fs-column-gap);
		--_fs-row-span: span 2;
		--_fs-column-one: 1 / span 2;
		--_fs-column-two: 3 / span 2;
	}
}
```

The narrow block is what undoes the shipped `52rem` rule between `52rem` and `64rem`; without it the group would go two-column at the old length and the override would add a breakpoint rather than move one. The `div.cols` wrapper rule tests the same length, so an override moving this breakpoint restates its `grid-template-columns` and `column-gap` at the new length too.

The form is a query container named `fs-form`, and every `fieldset` is one named `fs-group`. Because a group's container sits on the `fieldset`, the `ul` and its `li` children resolve the same container and cannot disagree about which side of a breakpoint they are on.

## Events

A client engine dispatches these `CustomEvent`s so site code can observe a form without patching the library. All bubble. **A server parser has nothing to do with this section.**

| Event              | Target                    | `detail`                  | Fired when                                                 |
|--------------------|---------------------------|---------------------------|------------------------------------------------------------|
| `fs:init`          | The `form`                | `{ model }`               | The engine finishes wiring the form                        |
| `fs:field-valid`   | The field's first control | `{ name, verdict, code }` | A field's verdict changes to `valid`                       |
| `fs:field-invalid` | The field's first control | `{ name, verdict, code }` | A field's verdict changes to `invalid`                     |
| `fs:submit`        | The `form`                | `{ payload }`             | Validation and pre-submit hooks passed, before the request |
| `fs:accepted`      | The `form`                | `{ envelope }`            | The server accepted the submission                         |
| `fs:rejected`      | The `form`                | `{ envelope }`            | The server rejected it on validation                       |
| `fs:error`         | The `form`                | `{ envelope }`            | The submission failed or the envelope was unreadable       |

`fs:field-valid` and `fs:field-invalid` fire only on a change into those two states; a field settling into `incomplete` fires neither. `code` is `null` on `fs:field-valid`.

A pre-submit hook registered through the engine's `addPreSubmitHook` API may contribute extra fields to the payload or abort the submission. Payment and captcha tokens travel that way, and the library never learns what they mean. A hook that aborts fires no event, because no envelope exists.

## Layout Classes

Layout lives in classes, which servers ignore; validation semantics live in `data-fs-*` attributes, which servers parse. **This entire section is non-normative for a server parser.** It is documented because the shipped stylesheet implements it and authors write it.

| Class         | Host                           | Effect                                                              |
|---------------|--------------------------------|---------------------------------------------------------------------|
| `block`       | A row, or a standalone element | Label above a full-width control; one pair wide in a `cols` group   |
| `cols`        | A field group `ul`             | Lays the group's rows into two label/control column pairs           |
| `cols`        | A `div` inside a section       | Pairs non-row content — toggle fieldsets, blocks — two-up when wide |
| `col-break`   | A row inside a `cols` group    | Splits the group: this row starts the second column                 |
| `compound`    | A wrapper inside a row         | Lays several controls sharing one label side by side                |
| `toggle-list` | A choice-group `fieldset`      | The styled checkbox and radio treatment                             |
| `buttons`     | With `toggle-list`             | Renders each choice as a toggle button instead of a box and a label |

In the `buttons` variant, radio groups render as one segmented control — the engine marks them `fs-segmented`, and physically joined buttons read as mutually exclusive — while checkbox groups stay separated, independent buttons. A segmented group that cannot fit on one line gets an engine-measured `fs-wrapped` class and falls apart into separated pills, still distinct from the checkbox rectangles. Both classes are engine-written presentation state, like the row state classes.

A `cols` group without a `col-break` flows **row-major**: rows fill left to right, pair by pair. This differs from FormSanity v1, which split a group at its midpoint and filled column-major, top to bottom. Pure CSS cannot express the midpoint split without knowing the row count, and the row-major flow is the honest reading of a source order. An author porting a v1 form that relied on the midpoint split MUST add an explicit `col-break` at the row that should start the second column.

With a `col-break` present the split is explicit: every row before the break stacks in the first column, and the break and every row after it stack in the second. A `block` row inside a `cols` group always spans both columns.

## Attribute Index

Every attribute this specification defines, and who reads it.

| Attribute                    | Host                   | Register  | Server parser |
|------------------------------|------------------------|-----------|---------------|
| `data-fs-form`               | `form`                 | Structure | Reads         |
| `data-fs-field`              | A row wrapper          | Structure | Reads         |
| `data-fs-type`               | A control              | Rule      | Reads         |
| `data-fs-type-param`         | A control              | Rule      | Reads         |
| `data-fs-equals`             | A control              | Rule      | Reads         |
| `data-fs-not-equals`         | A control              | Rule      | Reads         |
| `data-fs-equals-field`       | A control              | Rule      | Reads         |
| `data-fs-not-equals-field`   | A control              | Rule      | Reads         |
| `data-fs-greater-than-field` | A control              | Rule      | Reads         |
| `data-fs-less-than-field`    | A control              | Rule      | Reads         |
| `data-fs-min-digits`         | A control              | Rule      | Reads         |
| `data-fs-min-uppercase`      | A control              | Rule      | Reads         |
| `data-fs-min-lowercase`      | A control              | Rule      | Reads         |
| `data-fs-min-selected`       | Any member of a set    | Rule      | Reads         |
| `data-fs-max-selected`       | Any member of a set    | Rule      | Reads         |
| `data-fs-group-at-least-one` | Any member of a set    | Rule      | Reads         |
| `data-fs-group-all-or-none`  | Any member of a set    | Rule      | Reads         |
| `data-fs-unique-in-page`     | A control              | Rule      | Reads         |
| `data-fs-unique`             | A control              | Rule      | Reads         |
| `data-fs-max-file-size`      | A file control         | Rule      | Reads         |
| `data-fs-relevant`           | Any control of a field | Relevance | Reads         |
| `data-fs-irrelevant`         | Any control of a field | Relevance | Reads         |
| `data-fs-copy-to`            | A control              | Behavior  | Ignores       |
| `data-fs-amount`             | A control              | Behavior  | Ignores       |
| `data-fs-amount-total`       | Any element            | Behavior  | Ignores       |
| `data-fs-year-options`       | `select`               | Behavior  | Ignores       |
| `data-fs-month-options`      | `select`               | Behavior  | Ignores       |
| `data-fs-prefix`             | A control              | Behavior  | Ignores       |
| `data-fs-suffix`             | A control              | Behavior  | Ignores       |
| `data-fs-reveal`             | A password input       | Behavior  | Ignores       |
| `data-fs-when-valid`         | Any element            | Behavior  | Ignores       |
| `data-fs-no-gate`            | `form`                 | Behavior  | Ignores       |
| `data-fs-message-incomplete` | `form`                 | Behavior  | Ignores       |
| `data-fs-message-invalid`    | `form`                 | Behavior  | Ignores       |
| `data-fs-label`              | A control              | Behavior  | Ignores       |
| `data-fs-error-to`           | A control              | Behavior  | Ignores       |

The engine writes `data-fs-field="<name>"` onto the error bubbles it creates. A server parser reading authored markup never encounters those, and MUST treat `data-fs-field` on a `p.fs-error` as an engine internal rather than a row boundary.
