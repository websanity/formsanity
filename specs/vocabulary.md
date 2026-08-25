# FormSanity Vocabulary Specification

**Version:** 2. **Status:** normative.

FormSanity forms carry their own logic. Validation rules, cross-field comparisons, and conditional display are written into the markup, as native HTML constraint attributes and `data-fs-*` attributes. An implementation reads the markup and enforces what it finds. This document defines that vocabulary completely. A client engine, a server-side parser, or any other consumer can implement it without reading the source of another implementation.

The companion document `submission-protocol.md` defines the request format, the response envelope, the error-code payload, and the uniqueness sub-protocol. This document owns the markup. That one owns the wire.

## Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as defined in RFC 2119.

_Author_ means the person who writes the markup of the form. _Client engine_ means an implementation that runs in the browser against a live DOM. _Server parser_ means an implementation that reads the same markup statically (a template, a stored document, or a re-render) and validates a submitted payload against it. _Control_ means an `input`, `select`, or `textarea` element with a `name`. _Field_ means every control in a form that shares one `name`.

Attribute values are case-sensitive unless stated otherwise. Every attribute in this specification carries the `data-fs-` prefix. The markup is fully conforming HTML.

## Scope and Conformance

This specification defines four registers. The conformance of an implementation is measured separately in each.

| Register                   | What it covers                                                                                 | Who enforces it              |
|----------------------------|------------------------------------------------------------------------------------------------|------------------------------|
| Native register            | HTML's own constraint attributes: `required`, `minlength`, `pattern`, `min`, `accept`, and the rest | Client engine, server parser |
| `data-fs-*` rules          | Formats, cross-field comparisons, groups, composition, and file limits                         | Client engine, server parser |
| Relevance                  | `data-fs-relevant` and its expression grammar                                                  | Client engine, server parser |
| Behaviors and presentation | Value mirroring, totals, generated options, error DOM, status region                           | Client engine only           |

A conforming **client engine** MUST implement all four registers. It MUST take over the presentation of validation errors: it sets `novalidate` on the form and renders the error DOM that this document specifies.

A conforming **server parser** MUST implement the native register, the `data-fs-*` rules, and relevance. It MUST ignore the behavior and presentation attributes entirely. Those attributes describe browser conveniences, with no effect on whether a submission is acceptable. It MUST NOT depend on layout classes.

A server parser MUST NOT trust a submitted value because the client accepted it. Every rule that this document marks as server-enforceable is re-checked at the server, and the verdict of the server is authoritative.

### Conformance Suite

Two JSON vector files in `vectors/` are the shared conformance corpus. Both are normative. An implementation that disagrees with a vector is wrong.

| File                       | Entry shape                                  | Pins                                     |
|----------------------------|----------------------------------------------|------------------------------------------|
| `vectors/validators.json`  | `{ "type", "value", "param"?, "expected" }`  | The `data-fs-type` three-state verdicts  |
| `vectors/expressions.json` | `{ "expr", "fields", "types"?, "expected" }` | The expression grammar and its semantics |

`expected` in `validators.json` is one of `"valid"`, `"incomplete"`, `"invalid"`. `expected` in `expressions.json` is a boolean. In `expressions.json`, `fields` maps a field name to a raw string value. The optional `types` marks a field as `"date"` for chronological comparison. A name absent from `fields` reads as the empty string.

### Browser Floor

The reference client engine targets the Baseline Widely Available feature set. Container size queries, subgrid, native CSS nesting, and `@layer` are in bounds. Container style queries are not. Implementations MAY target more. But markup written to this specification MUST NOT require anything beyond the floor.

## Document Grammar

FormSanity reads two things from the document: which controls belong to which _row_, and which attributes those controls carry. The grammar exists to answer the first question without FormSanity-specific wrapper elements.

### Opting In

A form opts in with the `data-fs-form` attribute on its `form` element. The attribute takes no value.

```html
<form data-fs-form action="/join" method="post">
	…
</form>
```

A client engine MUST process only forms with `data-fs-form`. A server parser MUST treat `data-fs-form` as the anchor for everything below it. The `action` of a form names the submission endpoint. When `action` is absent, the client posts to the current URL.

### Structure

The default authoring mode is a small document grammar built from ordinary HTML.

- The form contains **sections**: `fieldset` elements. A `legend` opens each section and names it. A `p` after the legend is section-level prose.
- A section contains **field groups**: `ul` elements.
- A field group contains **rows**: `li` elements.
- A row contains a `label`, the control or controls of the row, and an optional `small` **annotation** that describes the field.

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

The label of a row MUST be the first element child of the row. Everything else in the row is the content of the row.

### Freeform Rows

For layouts that the grammar does not cover, an author marks a row explicitly: `data-fs-field` on a wrapper around the label and its control. The attribute takes no value. A freeform row wrapper MUST be a flow container. A `div` is the expected element.

```html
<div data-fs-field>
	<label for="promo">Promo code</label>
	<input id="promo" name="promo" data-fs-type="alphanum">
</div>
```

Freeform rows are independent of one another. Each sizes its own label column, so labels align across rows only inside a field group. Authors who want aligned labels SHOULD use a field group.

### Row Resolution

The row of a field is the closest ancestor of its first control that matches the selector `li, [data-fs-field], .fs-stacked`. This one rule covers both authoring modes: the `li` of the structured grammar, the `fs-stacked` field layout, and an explicit `data-fs-field` wrapper all answer to it.

A **choice group** is a field with two or more controls whose first control is a checkbox or a radio button. A choice group has no row. Implementations MUST fall back to the closest ancestor `fieldset` of the field for row-scoped presentation. The consequences are stated under Relevance and the Presentation Contract.

A row MAY host more than one field. A compound field is exactly that case. Then the state of the row reflects the **worst** verdict among the fields on it, in the order `invalid` < `incomplete` < `valid`. Error messages stay per-field.

### Choice Groups

Radio and checkbox sets use their own grammar: a `fieldset` whose `legend` is the label of the group, with a `ul` of `li` rows, each row a `label` that wraps its own input.

```html
<fieldset class="fs-toggles">
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

Some rule attributes apply to a choice group as a whole: `data-fs-min-selected`, `data-fs-max-selected`, `data-fs-group-required-any`, `data-fs-group-required-together`, `data-fs-relevant`, and `data-fs-irrelevant`. Such an attribute MAY sit on any member control of the set. The first member with the attribute wins. Implementations read every other attribute from the first control of the field only.

### Compound Fields

Two or more controls MAY share one label. The shared label becomes a `span` with an `id`, and each control points at it with `aria-labelledby`. A `div.fs-compound` wraps the controls.

```html
<li>
	<span id="name-label">Name</span>
	<div class="fs-compound">
		<input id="first-name" name="first-name" data-fs-type="alpha" aria-labelledby="name-label" placeholder="First">
		<input id="last-name" name="last-name" data-fs-type="alpha" aria-labelledby="name-label" placeholder="Last">
	</div>
</li>
```

Each inner control keeps its own `name` and its own validation attributes, so each is a separate field. Both fields resolve to the same row, and the worst-verdict rule above governs the state of the row.

The label of a compound row is a `span`, not a `label`. The automatic naming chain under Message Attributes cannot find it, and falls through to the `name` of the field. Thus compound controls SHOULD carry `data-fs-label`. One shared label names the row, but each control needs its own name in a message.

### Hidden Fields

A server MAY render `input[type="hidden"]` elements into the form. They need no FormSanity attribute. An engine gathers them like any other field and round-trips their values untouched. `submission-protocol.md` formalizes the obligation.

## Native Register

Native HTML is canonical wherever it can express a rule. An author MUST prefer the native attribute over any `data-fs-*` equivalent. FormSanity defines no `data-fs-*` attribute that duplicates one.

| Constraint            | Native attribute        | Notes                                                              |
|-----------------------|-------------------------|--------------------------------------------------------------------|
| Answer required       | `required`              | See the note on choice groups under Native Verdicts                |
| Minimum length        | `minlength`             | Text-like controls                                                 |
| Maximum length        | `maxlength`             | Text-like controls; also drives the characters-remaining counter   |
| Minimum value         | `min`                   | Numeric, date, and time controls; see `data-fs-min` for fs types   |
| Maximum value         | `max`                   | Numeric, date, and time controls; see `data-fs-max` for fs types   |
| Format by pattern     | `pattern`               | An unanchored ECMAScript regex, implicitly anchored by HTML        |
| File extension filter | `accept`                | Raises no `ValidityState` flag — enforced as a rule; see Files     |
| Email address         | `type="email"`          | HTML's own definition; see the note under `data-fs-type` below     |
| URL                   | `type="url"`            |                                                                    |
| Date                  | `type="date"`           | Also marks the field as date-typed for comparisons and expressions |
| Time                  | `type="time"`           | Value is always 24-hour `HH:MM` regardless of the locale's display |
| Date and time         | `type="datetime-local"` | Value is `yyyy-mm-ddThh:mm`; the popup is engine-dependent         |
| Telephone entry       | `type="tel"`            | Validates nothing — keypad and autofill semantics only; see below  |
| Number                | `type="number"`         | With `min` and `step` for the variants below                       |

### Numeric Variants

The five numeric formats that a form usually wants are combinations of `type="number"` with `min` and `step`. No `data-fs-*` attribute is involved.

| Format               | Markup                           |
|----------------------|----------------------------------|
| Number               | `type="number"`                  |
| Non-negative number  | `type="number" min="0"`          |
| Positive number      | `type="number" min="0.01"`       |
| Integer              | `type="number" step="1"`         |
| Non-negative integer | `type="number" min="0" step="1"` |
| Positive integer     | `type="number" min="1" step="1"` |

HTML has no exclusive minimum, so a positive number states the smallest value that it accepts. `min="0.01"` above is an illustration, not a rule. Select the granularity that the field needs.

### Native Verdicts

Native constraints report through `ValidityState`. More than one of its flags can be set at the same time. Thus the verdict and the code are derived **independently**: the same value can report a `min` code with an `invalid` verdict. Implementations MUST use both rules below.

**The verdict.** It is `valid` when the state is valid. Otherwise it is `invalid` when **any** of `badInput`, `tooLong`, `rangeOverflow`, or `stepMismatch` is set, and `incomplete` otherwise. The rule behind that set: a value that can become acceptable through appended characters is `incomplete`. A value that no continuation can rescue is `invalid`. A too-short string can grow. A too-long string cannot shrink through typing. A value below `min` can climb. A value above `max` cannot fall.

**The code.** It is the code of the **first flag set**, in the order below. The order is normative. It decides which of several simultaneous failures the person is told about.

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

The two rules diverge whenever a low-ordered flag that does not contribute `invalid` is set together with a high-ordered one that does. Worked example, pinned here in the way a vector pins it:

```
<input type="number" min="5" step="2" value="4">
	rangeUnderflow: true   (4 is below min)
	stepMismatch:   true   (the step base is 5, so 5, 7, 9 … are allowed; 4 is not)

	code    = min        — rangeUnderflow is order 7, stepMismatch is order 9
	verdict = invalid    — stepMismatch is in the invalid set
```

A read of the code from the first column of the table, and of the verdict from the same row, gives `incomplete`. That is wrong: no character appended to `4` produces a permitted value.

The native constraints of a field are read from its **first control**. On a radio group this costs nothing: the platform raises `valueMissing` on every radio in a group when any of them is `required`. On a checkbox set it matters. `required` binds to the one checkbox that carries it. Thus an author who wants a required checkbox set MUST place `required` on its first member, or use `data-fs-min-selected="1"`, which knows the set.

### Re-Deriving Native Constraints Without a Browser

A server parser has no `ValidityState` and MUST re-derive the flags from the attributes. The two rules above then apply unchanged. Three details decide whether the re-derivation agrees with a browser.

**Emptiness belongs to `required` alone.** An empty value MUST NOT raise `patternMismatch`, `tooShort`, `tooLong`, `rangeUnderflow`, `rangeOverflow`, or `stepMismatch`. Only `valueMissing` speaks to an empty value. The `data-fs-*` rules carry the same exemption. This is what keeps an optional constrained field optional: a blank input with a `pattern` is valid, not malformed. A server that skips this check rejects every untouched optional field on the form.

**`step` measures divisibility from a base, not from zero.** The step base is `min` when `min` is present, and `0` otherwise. For a `date` control with no `min`, the base is the epoch. A value violates `step` when the difference between the value and the base is not an integer multiple of the step. When the attribute is absent, the default step is `1` for `type="number"` and one day for `type="date"`. `step="any"` disables the check entirely. Thus `min="5" step="2"` permits 5, 7, and 9, and rejects 4 and 6. A read of the step as plain divisibility by two wrongly accepts 6.

**`pattern` is anchored and matches the whole string.** The value of the attribute is an unanchored ECMAScript regular expression. The platform compiles it with the `v` flag and applies it as if wrapped in `^(?:` … `)$`. A server MUST anchor it the same way. It MUST NOT apply implicit case-insensitivity or multiline semantics. It MUST treat a value as matching only when the match spans the entire string. A server whose regex engine cannot offer `v`-flag semantics SHOULD compile with the closest available Unicode mode. It SHOULD treat a pattern that it cannot compile as an authoring error, not as a silent pass.

Beyond those three, the mapping is mechanical: emptiness against `required`, string length in UTF-16 code units against `minlength` and `maxlength`, and numeric or chronological order against `min` and `max`.

## Field Types

`data-fs-type` names formats that HTML cannot express. Its value is exactly one type name from the table below. A type check never fires on an empty value. Emptiness belongs to `required`.

`data-fs-type-param` carries a parameter for the type. Only `credit-card` reads one today.

Two fs types define an **ordering** of their own: `duration` (chronological, by elapsed minutes) and `us-dollar` (numeric, with `$` and thousands commas ignored). A control of an ordered type MAY carry `data-fs-min` and `data-fs-max`, written in the format of the type (`data-fs-min="2:00"`, `data-fs-min="$5.00"`). An implementation MUST compare in the order of the type. A value under the minimum is `incomplete` with code `min`. A value over the maximum is `invalid` with code `max`. These are the same verdicts that the native mapping gives `rangeUnderflow` and `rangeOverflow`. A value that the type cannot parse yields no bounds verdict. Malformedness belongs to the type check. On unordered fs types, the attributes have no effect. These attributes are the `data-fs-*` twins of native `min` and `max`, not the native attributes themselves, because fs types live on `type="text"` controls. There, native `min` and `max` are not conforming HTML. This is the one bound that the native attributes cannot legally express.

A typed field MAY carry a native `list` attribute that points at a `<datalist>` of suggested values. The suggestions belong to the author. The validation stays with the type. An engine treats the datalist as inert markup. This is the blessed pattern for guided entry where no native picker exists. `duration` is the canonical case.

A phone-validated field SHOULD use `type="tel"` as its element type. `tel` defines no format of its own, because HTML leaves phone formats open on purpose. Thus it composes with `us-phone` or `international-phone` instead of a replacement for them. The element type buys the telephone keypad and the autofill semantics. The `data-fs-type` buys the validation. `autocomplete="tel"` completes the autofill story.

```html
<input id="card" name="card" type="text" data-fs-type="credit-card" data-fs-type-param="Visa|MasterCard">
```

The code of a violation is `type.` followed by the type name: `type.email`, `type.credit-card`, and so on. A type name outside the table below is an authoring error. An implementation MUST report it, not accept the field silently.

### Pattern Types

Each of these types is defined by two regular expressions. `full` matches a complete, valid value. `prefix` matches a value that can still become valid through appended characters. A value that matches `full` is `valid`. Otherwise, a value that matches `prefix` is `incomplete`. Otherwise, the value is `invalid`. This table is normative.

| Type            | `full`                            | `prefix`                                    |
|-----------------|-----------------------------------|---------------------------------------------|
| `alpha`         | `/^[A-Za-z]+$/`                   | `/^[A-Za-z]*$/`                             |
| `alphanum`      | `/^[A-Za-z0-9]+$/`                | `/^[A-Za-z0-9]*$/`                          |
| `identifier`    | `/^[A-Za-z0-9_-]+$/`              | `/^[A-Za-z0-9_-]*$/`                        |
| `no-whitespace` | `/^\S+$/`                         | `/^\S*$/`                                   |
| `email`         | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` | `/^[^\s@]+(@[^\s@]*)?$/`                    |
| `cvv`           | `/^\d{3,4}$/`                     | `/^\d{0,4}$/`                               |
| `ssn`           | `/^\d{3}[- ]?\d{2}[- ]?\d{4}$/`   | `/^\d{0,3}([- ]?\d{0,2}([- ]?\d{0,4})?)?$/` |
| `duration`      | `/^(\d{1,4}\                      | \d{1,3}:[0-5]?\d)$/`                        |
| `us-dollar`     | `/^\$?(\d+\                       | \d{1,3}(,\d{3})+)(\.\d{0,2})?$/`            |
| `zip`           | `/^\d{5}(-?\d{4})?$/`             | `/^\d{0,5}(-?\d{0,4})?$/`                   |

A `|` inside a pattern cell is written `\|`, so the pipes of the table stay unambiguous. The real expressions use plain `|` alternation. The `i` flag means that the expression is case-insensitive.

`duration` carries one check beyond its patterns: a zero duration is no duration. A full-matching value that reads zero minutes is `invalid` when both minute digits are typed (`0:00` — appended characters cannot make it non-zero). It is `incomplete` otherwise (`0`, `0:0` — still on the way to `0:30`).

### `email` and `type="email"`

Both registers can check an email address, and they disagree on purpose.

Native `type="email"` follows HTML's definition, which accepts a bare host with no dot: `jans@websanity` is a conforming value. `data-fs-type="email"` also requires a dot and a top-level label of at least two characters. Thus `jans@websanity` is `incomplete` and `jans@websanity.com` is `valid`.

Use `type="email"` when you want the platform's definition, with the mobile keyboard and the no-JavaScript validation floor that it brings. Use `data-fs-type="email"` when the form collects deliverable addresses on the public internet and a bare host is a typo. The two MAY be combined on one control. The verdict of the field is then the worse of the two checks, and the native check reports first.

### Algorithmic Types

The remaining types are defined by procedure, not by a pattern.

**`ipv4`.** Reject as `invalid` a value with a character outside `[0-9.]`, or a value that splits on `.` into more than four parts. Every part except the last MUST be non-empty, at most three characters, and numerically at most 255. A part that fails any of those is `invalid`. The last part MUST be at most three characters, and at most 255 if non-empty. The value is `valid` when it has exactly four parts and the last is non-empty. Otherwise it is `incomplete`.

**`ipv6`.** Reject as `invalid` a value with a character outside `[0-9A-Fa-f:]`, or a value with `::` more than once. Replace the first `::` with `:x:`, split on `:`, and discard empty parts. `x` marks the elision. A real group longer than four characters is `invalid`. A count of real groups above eight is also `invalid`. The value is complete when it elides and holds at most seven real groups, or does not elide and holds exactly eight. A complete value that does not end in `:` is `valid`. Anything else is `incomplete`.

**`ip`.** Run both `ipv4` and `ipv6` and return the better verdict. `valid` ranks above `incomplete`, which ranks above `invalid`.

**`email-list`.** Split the value on runs of whitespace and commas, and discard empty items. Validate each item as `email`. An item that comes back `incomplete` and is _not_ the last item becomes `invalid`. The author moved past it, so it is finished and wrong. The verdict of the list is the verdict of the worst item. An empty list is `valid`.

**`credit-card`.** Strip spaces and hyphens. A remaining non-digit makes the value `invalid`. Read the permitted network list from `data-fs-type-param`, split on `|`. An absent parameter means `Visa|MasterCard|Amex|Discover`. An unrecognized name is ignored. Determine the candidate networks. Then: no candidates means `invalid`. More digits than the longest length that any candidate accepts means `invalid`. A digit count equal to an accepted length of some candidate hands the decision to the Luhn checksum: a pass is `valid`, a fail is `invalid`. Anything else is `incomplete`.

Candidacy is the subtle part. **A network is a candidate only after its full issuer prefix is entered.** Below two digits, every permitted network is a candidate, because one digit cannot disqualify a two-digit prefix. From two digits on, a network is a candidate only when the value starts with one of its prefixes. A partly typed prefix does not keep it alive. With `Discover` as the only permitted network, `6` is `incomplete` (still under two digits), while `60` and `601` are both `invalid`: neither has reached `6011` or `65`, and no other network can rescue them. This is deliberate. The check fails a doomed number as early as the prefix proves it doomed. The person does not type fifteen more digits first.

| Network      | Issuer prefix        | Accepted lengths |
|--------------|----------------------|------------------|
| `Visa`       | `4`                  | 13, 16, 19       |
| `MasterCard` | `51`–`55`, `22`–`27` | 16               |
| `Amex`       | `34`, `37`           | 15               |
| `Discover`   | `6011`, `65`         | 16, 17, 18, 19   |

A number that reaches an accepted length and fails Luhn is a **dead end**, not a work in progress. An appended digit can only make it a different length. That length is either another accepted length, checked again on its own merits, or past the maximum. This is the one place where a type check calls a value `invalid` on arithmetic instead of shape.

The Luhn checksum: walk the digits from right to left. Double every second digit. Subtract 9 from a doubled result above 9. Sum all digits. The number passes when the sum is divisible by ten.

**`us-phone`.** A character outside `[0-9() .-]`, beyond an optional leading `+`, makes the value `invalid`. A leading `+` MUST introduce country code `1`. A `+` followed by any other first digit is `invalid`. Eleven digits whose first is `1` count as the ten that follow the country code. Any other count above ten is `invalid`. Exactly ten digits (after the country-code discount), arranged to match `/^(\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}$/`, is `valid`. Anything else is `incomplete`.

**`international-phone`.** A character outside `[0-9() .-]`, beyond an optional leading `+`, makes the value `invalid`. More than fifteen digits is `invalid`. Seven or more digits is `valid`. Fewer is `incomplete`.

### Canonicalization

Several types accept more formats than they submit. Each type below defines one **canonical format**. An engine MUST rewrite the value of a control to it when two things are true: the value is `valid`, and the person has committed it. Commit means the native `change` event, which fires on blur or Enter but never mid-keystroke. A not-valid value is never rewritten. The type check owns the report about the characters that the person actually typed.

| Type                  | Canonical format            | Example rewrite                     |
|-----------------------|-----------------------------|-------------------------------------|
| `us-phone`            | `(###) ###-####`            | `1 303.555.1234` → `(303) 555-1234` |
| `international-phone` | `+` and digits only         | `44 20 7946 0958` → `+442079460958` |
| `ssn`                 | `###-##-####`               | `123456789` → `123-45-6789`         |
| `zip`                 | `#####` or `#####-####`     | `802101234` → `80210-1234`          |
| `us-dollar`           | plain digits, two decimals  | `$1,234.5` → `1234.50`              |
| `duration`            | `H:MM`, minutes zero-padded | `90` → `1:30`                       |

Canonicalization is why the acceptance grammars above are as loose as they are. The type forgives what the person plausibly meant. Then the rewrite settles what the form actually says. The two halves are one contract. An implementation MUST NOT widen acceptance without the rewrite. Otherwise the same answer reaches the server in as many byte forms as there are people who type it. Thus a server that implements the submission protocol MAY expect the values of these types in canonical form from a conforming client. It MUST still validate what actually arrives.

The rewrite happens before the validation refresh of the commit. Thus bound comparisons (`min`/`max` on ordered types) and cross-field rules read the canonical value. Types not in the table, including every native input type, are never rewritten. Their values submit exactly as typed.

## Three-State Validation

Every check yields one of three verdicts.

| Verdict      | Meaning                                                           | Example                                            |
|--------------|-------------------------------------------------------------------|----------------------------------------------------|
| `valid`      | The value satisfies the rule                                      | `jans@websanity.com` for `email`                   |
| `incomplete` | Appended characters can make it valid — the **appending rule**    | `jans@web` for `email`, `192.168.` for `ipv4`      |
| `invalid`    | A dead end no continuation can fix                                | `jans@web@x` for `email`, `192.168.1-1` for `ipv4` |

The appending rule is the whole test. Ask: does _some_ string of characters, appended to this value, produce a valid one? If yes, the verdict is `incomplete`. If no, the verdict is `invalid`. Deletion, insertion in the middle, and retyping do not count. Only appending counts, because that is what a person who types forward can do next.

### Merging Verdicts

The verdict of a field is the **worst** verdict among every check that applies to it. `invalid` ranks worse than `incomplete`, which ranks worse than `valid`. The reported code and message belong to the first check that produced that worst verdict, in this order: native constraints, then the `data-fs-type` check, then each `data-fs-*` rule in document order, then group membership.

The type check is skipped when the native constraints have already returned `invalid`, and when the value is empty.

### Timing

Timing is a client-engine obligation. A server sees only the final state.

- An `invalid` verdict presents immediately, on `input`. A letter in a number field is wrong the moment it is typed.
- An `incomplete` verdict presents on **commit**: blur, or the native `change` event. A picker selection or an Enter press fires `change` without a blur. A half-typed email address draws no complaint, because `change` never fires per keystroke. The requiredness codes (`required`, `group.required-any`, `group.required-together`, and `min-selected`) are the exception. They mean "not answered yet", not "answered wrong", and they **never present a bubble**: not on commit, not at submit. The asterisk indicator and the form-level status line are the whole voice of requiredness.
- After a field has presented an error, it re-validates on every `input`. Thus the error clears the moment the value is correct.
- A submit attempt presents every outstanding wrong-answer error. Requiredness stays bubble-less. Focus moves to the first non-valid field.
- `data-fs-group-unique-values` is checked on commit only (blur or `change`). A transient collision mid-typing is not an error.

### Submit-Time Collapse

At submit time, `incomplete` collapses into `invalid`. A submission is offered only when every relevant field is `valid`. Thus the server and the protocol see two states, not three. The error codes in the response envelope are the codes that this document defines.

## Rules

Every rule attribute below is authored on a control. Unless the Document Grammar says otherwise, an implementation reads it from the first control of the field. Each entry gives the value syntax of the attribute, its semantics, the verdict of a violation, and the code that it reports.

### Constraint Expressions

`data-fs-constraint` holds an expression in the grammar of the Expression Grammar section, the same grammar that `data-fs-relevant` uses. The name and the idea come from the `constraint` property of XForms, as `data-fs-relevant` borrows its `relevant`. The expression must hold for an acceptable value. Constraints are the entire comparison surface of the vocabulary: value against literal, field against field, and any boolean combination.

```html
<li>
	<label for="password-confirm">Confirm password</label>
	<input id="password-confirm" name="password-confirm" type="password" data-fs-constraint="password-confirm == password" data-fs-constraint-message="Passwords do not match.">
</li>
```

```html
<input id="checkout" name="checkout" type="date" data-fs-constraint="checkout >= checkin" data-fs-constraint-message="Check-out cannot precede check-in.">
```

The attribute lives on the field that it judges, and refers to that field by its own `name`. A violation flags that field alone. Each field takes one constraint. Authors combine clauses with `&&`.

An engine MUST evaluate a constraint only when the host field and every referenced field are non-empty. A client engine also skips the constraint while a referenced field holds an answer that its own validation rejects. This neutralizes the empty-is-false polarity of the grammar: a field is never flagged because a question that it depends on has no answer yet. The error stays on the field that needs the correction, because an invalid reference carries its own flag. Emptiness stays the business of `required`.

A violation reports code `constraint`. The author SHOULD supply `data-fs-constraint-message` with prose for the bubble. No message can be synthesized from an expression tree, so an absent message falls back to a generic catalog line.

**The verdict is three-state**, evaluated by a client engine over the expression tree. Every node yields _satisfied_ (true now), _possible_ (false now, appended characters can make it true), or _dead-end_ (false now, no continuation can rescue it):

- `==`. Equal is _satisfied_. One value a prefix of the other is _possible_. Anything else is a _dead-end_. Equality is the only operator that can prove a dead-end: two values where neither prefixes the other can never grow equal.
- `!=` and the ordering operators. True is _satisfied_, false is _possible_. Appended characters can always repair them.
- `!`. _Satisfied_ becomes _possible_: a true operand can usually be edited false, so its negation never claims a dead-end. _Possible_ and _dead-end_ become _satisfied_: the operand is false now, so the negation is true now.
- `&&`. _Dead-end_ if either side is. _Satisfied_ if both are. Otherwise _possible_.
- `||`. _Satisfied_ if either side is. _Dead-end_ only if both are. Otherwise _possible_.
- A bare operand. _Satisfied_ when non-empty, _possible_ otherwise.

_Possible_ is `incomplete`. A _dead-end_ is `invalid` and presents immediately. That is what makes `confirm == password` flag a masked confirm field the moment it diverges. The dead-end doctrine is the appending model used everywhere else in this document: deletion can fix anything, so it proves nothing.

A server parser needs none of this. At submit time, `incomplete` collapses into `invalid`. Thus the two-valued evaluator that the server already implements for relevance is the whole obligation: evaluate the expression against the submitted values, and reject with code `constraint` on false. The three-state layer is client-side error timing only. Conformance vectors whose entry carries a `verdict` key pin the three-state result, for engines that implement it.

### Daily Time Windows

`data-fs-min-time` and `data-fs-max-time` constrain the **time-of-day component** of a `datetime-local` control. The native `min` and `max` attributes keep their constraint on the linear span. Together they say what native attributes alone cannot: "any day in the span, within these hours each day". Each attribute holds a valid 24-hour time string (`HH:MM`). On any other control type, the attributes have no effect.

```html
<input name="meeting" type="datetime-local" min="2010-06-01T09:00" max="2010-06-30T17:00" data-fs-min-time="09:00" data-fs-max-time="17:00">
```

A time-of-day under `data-fs-min-time` is `incomplete` with code `min-time`. One past `data-fs-max-time` is `invalid` with code `max-time`. This is the same climb-or-fall logic that native bounds follow. When `data-fs-min-time` exceeds `data-fs-max-time`, the window wraps midnight, as reversed native `time` bounds do. A value inside neither the evening nor the morning is `incomplete` with code `min-time`, reported once for the pair. A bound quoted in a message renders in the locale of the user, like every temporal bound.

The window is one window, applied to every day in the span. Weekday masks, multiple windows, and calendar exclusions are scheduling logic, outside the vocabulary on purpose.

### Password Composition

These three count character classes.

| Attribute               | Value              | Semantics                                |
|-------------------------|--------------------|------------------------------------------|
| `data-fs-min-digits`    | A positive integer | At least _n_ characters matching `[0-9]` |
| `data-fs-min-uppercase` | A positive integer | At least _n_ characters matching `[A-Z]` |
| `data-fs-min-lowercase` | A positive integer | At least _n_ characters matching `[a-z]` |

An empty value never violates a composition rule. All three are `incomplete` on violation, because more typed characters can always satisfy them.

### Groups

A group is named. Its members are the fields that carry the same attribute with the same name. Every member reports the verdict of the group.

| Attribute                         | Value        | Semantics                                       | Verdict      | Code                      |
|-----------------------------------|--------------|-------------------------------------------------|--------------|---------------------------|
| `data-fs-group-required-any`      | A group name | At least one member MUST hold a non-empty value | `incomplete` | `group.required-any`      |
| `data-fs-group-required-together` | A group name | Either every member holds a value or none does  | `incomplete` | `group.required-together` |

When a required-any group is entirely empty, **every** member reports `group.required-any`. When a required-together group is partly filled, **each empty** member reports `group.required-together`. A filled member is satisfied. Neither rule fires on a wholly empty required-together group.

```html
<li>
	<label for="home-phone">Home phone</label>
	<input id="home-phone" name="home-phone" type="text" data-fs-type="us-phone" data-fs-group-required-any="phone">
</li>
<li>
	<label for="mobile-phone">Mobile phone</label>
	<input id="mobile-phone" name="mobile-phone" type="text" data-fs-type="us-phone" data-fs-group-required-any="phone">
</li>
```

The value of a field for group purposes is the value of its control. For a choice group, it is the values of the checked members, joined with commas. Thus a set with nothing checked counts as empty.

### Selection Counts

These limit a choice group or a `select[multiple]` list. On a list, the count is its selected options. Either attribute MAY sit on any member of the set, or on the `select` itself.

| Attribute              | Value                  | Semantics                    | Verdict      | Code           |
|------------------------|------------------------|------------------------------|--------------|----------------|
| `data-fs-min-selected` | A non-negative integer | At least _n_ members checked | `incomplete` | `min-selected` |
| `data-fs-max-selected` | A positive integer     | At most _n_ members checked  | `invalid`    | `max-selected` |

The asymmetry is the appending rule at work. Too few boxes can still be corrected with more checks, so it is `incomplete`. Too many is a state that the person has to undo, so it is `invalid`.

### Uniqueness

Two different rules, one word.

`data-fs-group-unique-values="name"` requires the values of its members to be mutually distinct within the form. The members are every field that carries the attribute with the same name. A duplicate reports `invalid` with the code `group.unique-values`. Empty values never collide. A client engine MUST check this only on commit (blur, or the native `change` event that a select or picker fires), never mid-typing.

`data-fs-unique="url"` invokes the server-checked uniqueness sub-protocol, defined in `submission-protocol.md`. The value of the attribute is the check endpoint. A duplicate reports `invalid` with the code `unique`. The interactive check is advisory. The server's check at submission is authoritative, and a rate-limited or failed check MUST NOT mark the field invalid.

### Files

`data-fs-max-file-size` limits upload size. Its value is a size in the grammar below.

| Attribute               | Value  | Semantics                      | Verdict   | Code            |
|-------------------------|--------|--------------------------------|-----------|-----------------|
| `data-fs-max-file-size` | A size | No selected file may exceed it | `invalid` | `file.max-size` |

Extension filtering is native `accept`, and the browser alone treats it as **advisory**. The attribute filters the file picker, but a person defeats the filter with a drag-and-drop or the all-files option of the picker. `accept` raises no `ValidityState` flag either way. Thus an engine MUST enforce it as a rule of its own. A selected file is **admitted** when it matches any of the comma-separated tokens of the attribute. A `.ext` token matches the end of the file's name, case-insensitively. A `type/subtype` token matches the media type of the file exactly. A `type/*` token matches the major type of the media type. Every selected file must be admitted. Otherwise the field is `invalid` with code `file.accept`. A server that stores uploads MUST run the same check against the name and media type of each submitted file. `accept` is the only file-type constraint in the vocabulary.

The size grammar is a number followed by a unit, matching `/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i` after a trim of surrounding whitespace. The number MAY carry a decimal fraction. The unit is case-insensitive, and MAY have a space before it. Units are binary multiples of 1024: `b` is 1, `kb` is 1024, `mb` is 1048576, `gb` is 1073741824. `2MB`, `2mb`, `2 MB`, `1.5MB`, and `500b` are all well-formed. `2 gigs` is not. An implementation MUST report an authoring error, not guess.

```html
<li>
	<label for="attachment">Attachment</label>
	<input id="attachment" name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">
</li>
```

### Code Reference

Every code that an implementation can report, from markup or from the response envelope of a server.

| Code                                             | Source                                                | Violation verdict                                   |
|--------------------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| `required`                                       | native `required`, value empty                        | `incomplete`                                        |
| `type.<name>`                                    | `data-fs-type`                                        | `incomplete` or `invalid` per the three-state check |
| `type.native`                                    | native `typeMismatch`                                 | `incomplete`                                        |
| `badinput`                                       | native `badInput`                                     | `invalid`                                           |
| `pattern`                                        | native `pattern`                                      | `incomplete`                                        |
| `minlength` / `maxlength`                        | native                                                | `incomplete` / `invalid`                            |
| `min` / `max` / `step`                           | native; also `data-fs-min`/`-max` on ordered fs types | `incomplete` / `invalid` / `invalid`                |
| `constraint`                                     | `data-fs-constraint` expression false                 | `incomplete`; `invalid` at an `==` dead-end         |
| `min-time` / `max-time`                          | daily time window on `datetime-local`                 | `incomplete` / `invalid`                            |
| `min-digits` / `min-uppercase` / `min-lowercase` | password composition                                  | `incomplete`                                        |
| `group.required-any` / `group.required-together` | group membership                                      | `incomplete`                                        |
| `min-selected` / `max-selected`                  | choice-group counts                                   | `incomplete` / `invalid`                            |
| `file.max-size`                                  | `data-fs-max-file-size`                               | `invalid`                                           |
| `file.accept`                                    | native `accept`                                       | `invalid`                                           |
| `unique` / `group.unique-values`                 | server check / page check                             | `invalid`                                           |
| `relevance`                                      | a non-empty value arrived for an irrelevant field     | server-side only                                    |

Codes are stable identifiers, not messages. A client maps a server rejection back to a rule and a field without a parse of prose.

This table is the closed set for version 2. The prefix `x-` is reserved for a server's own codes, so no extension collides with a future addition. `submission-protocol.md` defines how one travels.

## Relevance

_Relevance_ is FormSanity's word for conditional logic, the concept that XForms named `relevant`. One attribute covers both show and enable: hide and disable are two presentations of the same idea.

| Attribute            | Value                  | Semantics                                                            |
|----------------------|------------------------|----------------------------------------------------------------------|
| `data-fs-relevant`   | An expression          | On a control: the field participates only while true. Elsewhere: a region |
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

- MUST NOT be validated. Its rules are inert, and it contributes nothing to the overall verdict of the form.
- MUST NOT be submitted. Its name does not appear in the payload.
- MUST have every one of its controls disabled, in both modes. The disabled state keeps the value out of a native submission and out of the tab order.
- MUST, in `hidden` mode, have its row hidden and marked as irrelevant. In `disabled` mode, the row stays in place, visibly inactive.

A field with no row (a choice group of two or more members, per the Row Resolution rule) has no box to hide. In `hidden` mode, such a field is disabled but stays in place, which is the presentation of `disabled` mode. A lone checkbox is a one-control field and hides normally. Only sets are affected. Authors who need a whole choice group to vanish SHOULD wrap it in a relevance region.

### Relevance Regions

`data-fs-relevant` on an element that is not a control makes that element a **region**: one expression governs the element and every field inside it. The element itself hides while irrelevant. With `data-fs-irrelevant="disabled"` on the element, it stays in place, grayed. Every field whose first control lives inside the region becomes irrelevant — unvalidated, unsubmitted, disabled — exactly as if each carried the expression.

```html
<ul data-fs-relevant="pay-method == 'card'">
	<li> … card number … </li>
	<li> … CVV … </li>
</ul>
<p data-fs-relevant="pay-method == 'invoice'">Nothing to fill in now — we will email an invoice after checkout.</p>
```

A region that holds no fields is pure conditional content: text that appears when it applies. It has no validation or submission semantics at all.

Relevance composes by **conjunction**. A field is relevant only while its own expression and the expression of every containing region are all true. Nested regions stack the same way. A server parser resolves the relevance of a submitted field the same way: the field's own attribute AND every ancestor's. It can, because containment is visible in the markup that it parses.

### Reaching Across a Relevance Boundary

The rules of an irrelevant field are inert, but its value stays in the DOM, and other fields can still name it: in a cross-field comparison, in a group, or in another relevance expression. That is where a client and a server part company. The client reads the value that still sits in the hidden control. The server sees a field that never arrived.

The vocabulary closes the gap with a prohibition, not with a winner. **A rule MUST NOT reference a field that can become irrelevant, and every member of a group MUST share the same relevance condition.** A form that violates that constraint has undefined behavior, and the two implementations are allowed to disagree about it.

### The Server Obligation

Relevance is normative, not decorative. **A server parser MUST treat a submitted value for an irrelevant field as a validation failure**, with the code `relevance` for that field. Otherwise relevance is a suggestion that a hostile client ignores, and every rule behind it becomes optional.

Only a **non-empty** value triggers the rejection. An empty submitted value for an irrelevant field is treated exactly as an absent one. The two are indistinguishable in intent, and several ordinary paths produce the empty form: a client that gathers before relevance settles, a `multipart/form-data` body with an empty part, or a proxy that normalizes missing keys. A rejection of those fails honest submissions and catches nothing. An empty value asserts no answer.

Server-side evaluation of relevance means evaluation of the same expression against the submitted payload. A field absent from the payload reads as the empty string, which is exactly how the client reads an unanswered field.

### Values in Expressions

An expression reads the current value of a field as a string.

- A text, number, date, or `select` field reads as its value. An unanswered one reads as `''`.
- A checked checkbox reads as its `value` attribute. An unchecked one reads as `''`. This is why `ship == 'on'` is the idiomatic test for a lone checkbox declared `value="on"`.
- A choice group reads as the values of its checked members, joined with commas, in document order. A `select[multiple]` reads the same way: the values of its selected options, comma-joined.

Chained relevance — a condition that names a field that can itself become irrelevant — falls under the constraint above and MUST be avoided. Write each condition against fields that are always relevant. Repeat a clause where a nested condition is tempting.

## Expression Grammar

One grammar serves `data-fs-relevant` and any future expression attribute.

```
expr       := or
or         := and ( '||' and )*
and        := unary ( '&&' unary )*
unary      := '!' unary | primary
primary    := operand ( ( '==' | '!=' | '<=' | '>=' | '<' | '>' ) operand )?
operand    := func | name | string | number | '(' expr ')'
func       := 'valid' '(' name ')'
name       := [A-Za-z_] [A-Za-z0-9_-]*
string     := "'" ( [^'] | "''" )* "'"     — '' is an escaped quote
number     := '-'? [0-9]+ ( '.' [0-9]+ )?
```

Whitespace between tokens is not significant. The grammar has one function. `valid(name)` is true when the named field is **answered and its answer passes the field's own validation**. It is the tool that gates the relevance of one field on the correct answer of another field, not on a merely filled one. A client engine reads the current verdict of the named field. A server parser re-derives the verdict: it validates the submitted value of the named field. A name followed by `(` is always a function call, and any function other than `valid` MUST be reported as a syntax error. A bare `valid` not followed by `(` stays an ordinary field name.

### Operands

A bare `name` reads the value of the named field, per the rules just above. An unknown or unanswered name reads as `''`.

A `string` is single-quoted. A literal single quote is written as two: `'O''Brien'` is the value `O'Brien`. Double quotes have no meaning in the grammar. They are ordinary characters inside a string, and a syntax error outside one. Expressions live in HTML attributes, thus authors SHOULD delimit the attribute with double quotes, so single quotes need no escape.

A `number` is a decimal literal, optionally negative. A numeric literal normalizes as a number and then stringifies. Thus `qty == 3`, `qty == 3.0`, and `qty == '3'` all test the value `'3'`.

### Operators

`==` and `!=` compare as **strings**, after both operands stringify. There is no numeric coercion and no type juggling: `'3'` and `'3.0'` are different values.

`<`, `<=`, `>`, and `>=` select their comparison from the types of the operands, with the same precedence chain that the cross-field ordering rules use. The comparison is **chronological** when either operand is a `date` or `datetime-local` field. It is a **time-of-day** comparison when either is a native `time` field. It is in **the type's own order** when either carries an ordered fs type (`duration`, `us-dollar`). It is **numeric** otherwise. A literal operand takes the reading of the other side. A time-of-day literal can omit the leading zero of the hour: `'9:30'` and `'09:30'` name the same instant. Control values themselves are always padded. A comparison MUST evaluate to false when either operand is empty or blank, and when either operand fails to parse as the chosen kind. This makes `qty > 3` false for an unanswered `qty`, not an error.

A comparison takes exactly one operator and does not chain: `a < b < c` is a syntax error, not a nested comparison.

`!`, `&&`, and `||` are the boolean operators. `||` binds loosest, then `&&`, then `!`. A comparison binds tighter than all three. Read `!` off the grammar, not off habit. `unary` recurses into `primary`, which swallows a whole comparison. Thus `!answer == 'yes'` negates the comparison, not the operand. Write `!(answer == 'yes')` when that is what you mean, and parenthesize whenever the meaning is not obvious. `&&` and `||` MAY short-circuit. The grammar has no side effects, so it does not matter.

A bare operand used where a boolean is expected is **truthy when its string value is non-empty**. `color` alone means _color was answered_. `color != ''` says the same thing more plainly and SHOULD be preferred.

`===` is not an operator and MUST be reported as a syntax error. The same applies to a single `=`, an unterminated string, unbalanced parentheses, and any trailing input after a complete expression.

### Vector File Format

`vectors/expressions.json` is an array of objects. Each object is one conformance case.

```json
[
	{ "expr": "color != ''", "fields": { "color": "red" }, "expected": true },
	{ "expr": "start < end", "fields": { "start": "2026-01-02", "end": "2026-02-01" }, "types": { "start": "date", "end": "date" }, "expected": true },
	{ "expr": "name == 'O''Brien'", "fields": { "name": "O'Brien" }, "expected": true }
]
```

An implementation passes when, for every entry, a parse of `expr` and an evaluation against `fields` (with `types` marking typed names) yields `expected`. An entry MAY carry a `valid` key: an object that maps field names to booleans, and supplies the verdicts that `valid()` reads. An absent name reads as `true`. An entry MAY also carry a `verdict` key (`"satisfied"`, `"possible"`, or `"dead-end"`) that pins the three-state constraint evaluation. It binds only implementations of the client-side verdict layer. A server parser ignores it.

## Behaviors

Behaviors are browser conveniences. **A server parser MUST ignore every attribute in this section.** None of them affects whether a submission is acceptable. A server that acts on one misreads the form.

A client engine MUST make a programmatic value change indistinguishable from a typed one. After it writes a value into a control, it dispatches a bubbling `input` event. Thus validation, dependent fields, other behaviors, and the submit gate all react as if the person typed the value.

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

### Clear on Change

`data-fs-clear-on-change` holds one or more source field `name`s, with spaces between them. When the value of a source changes, the host control empties (or unchecks, for a checkable control) and re-validates. This is for dependent answers: a confirm field whose confirmation means nothing after the password changes, or a state select whose choice is stale after the country changes. A stale dependent answer is worse than an empty one. The clear happens only when the host holds a value. The control whose input started a cascade is never cleared by that cascade. Thus, in a mutual pair, typed input into either side clears only the partner, and the answer in progress survives.

### Copy To

`data-fs-copy-to="target"` mirrors the answer of the source control onto the field named `target`, on every input. An unchecked toggle's answer is `''`, as everywhere in the vocabulary, so a deselected source blanks its mirror. A text-like target takes the answer directly. A **radio** target checks the member whose value matches the answer of the source, and unchecks the rest. No match, or an unanswered source, unchecks the whole set. The engine re-validates the target either way. A **checkbox** target mirrors the checked state of the member that matches the source's own value, and leaves its other members alone. Thus a checkbox set can mirror another set member by member. A source with no checked state of its own (a select, a text control) counts as holding its value, so it can check members. A chain propagates in full: A into B into C. A cycle collapses to a single hop, because a write is skipped once the target already holds the state.

### Amount Totals

`data-fs-amount` marks a control, or an `option` of a select, as a term. `data-fs-amount-total` marks an element as a destination. Totals are **form-wide**: every term in the form sums into every marked destination, once at init and again on every input. The sum renders with exactly two decimal places. A disabled term contributes nothing. That is how a term drops out when relevance disables its field.

A **bare** `data-fs-amount` reads the control's own value as the amount, with `$` and `,` stripped. A value that does not parse as a number contributes zero.

`data-fs-amount` **with a value** separates the price from the answer. The value of the attribute is the price, and it MAY be negative: a discount. The contribution is then:

- A checked checkbox or radio charges the price once. Unchecked charges nothing.
- A file control charges the price once while a file is selected.
- An `option` with the attribute charges its price once while selected: per-choice pricing without a change to the option's submitted value.
- Any other control multiplies the price by its numeric value (**unit pricing**: a quantity select with `data-fs-amount="10"` contributes 10 × the chosen count). It charges the price once for a non-numeric answer, and charges nothing while empty.

A destination that is itself a form control receives the sum as its `value`. That is a value change, so it dispatches `input`. Any other element receives the sum as its text.

Display and transport are different jobs, and the RECOMMENDED pattern uses a different element for each: an `<output>` shows the total, and a hidden input posts it, both marked as destinations. A visible read-only input can do both jobs at once, but a total in an editable-looking box invites edits. A hidden input marked `data-fs-amount-total` is the author's transport for the computed sum. The byte-for-byte round-trip rule of the submission protocol for hidden inputs does not apply to it, and `submission-protocol.md` says so.

```html
<li>
	<label for="donation">Donation</label>
	<input id="donation" name="donation" type="text" data-fs-amount>
</li>
<li>
	<span>Total</span>
	<output id="total" data-fs-amount-total></output>
	<input name="total" type="hidden" data-fs-amount-total>
</li>
```

### Generated Date Options

Both attributes take two integer offsets, `from,to`, with `from` at or below `to`. Options are generated once at initialization and **appended after** any static options already present. Thus an author's placeholder stays first.

`data-fs-year-options` offsets whole years from the current year. The value and label of each option are the four-digit year: `"0,5"` in 2026 yields 2026 through 2031. Offsets run in either direction: `"-15,10"` reaches fifteen years back and ten forward.

`data-fs-month-options` offsets whole months from the current calendar month, not from the start of the year. The value of each option is the resulting calendar month number, 1 through 12. Its label is `MM - Mon`, for example `08 - Aug`. A `select` carries no year, so an offset run across a year boundary wraps: `"0,11"` always yields exactly the twelve calendar months that start at the current one, in order, once each. This **rolling twelve-month window** is deliberate and differs from a calendar-year list.

### Password Reveal

A password control SHOULD declare its `autocomplete` intent: `new-password` where an account is created or changed, `current-password` where one is entered. Then password managers behave predictably instead of guessing.

`data-fs-reveal` on a password input appends a `button.fs-reveal` after the control, rendered as an accent cap with a visibility eye glyph. Activation toggles the control between `type="password"` and `type="text"`. The button reflects its state through its `aria-label` ("Show password" / "Hide password"), `aria-pressed`, and the glyph (open eye / slashed eye).

### Caps

`data-fs-prefix` and `data-fs-suffix` on a control render its value as a cap fused to the box of the control: an informational bookend such as a currency mark or a unit. The engine wraps the control in a `span.fs-caps` flex wrapper that holds `span.fs-prefix` and `span.fs-suffix` elements as declared. The wrapper takes over the border and background of the control. A `data-fs-reveal` button renders inside the same wrapper, as an interactive suffix cap. Caps are presentation only. They never touch the value of the control or the submitted payload. The cap text is not associated with the control for assistive technology. Meaning that matters belongs in the label or an annotation.

File inputs are capped automatically. A file control with no `data-fs-suffix` of its own gets a "Choose file…" suffix cap in the accent color. The native file-selector button is hidden. The cap forwards its clicks to the input, and is marked `aria-hidden`, because the input itself stays the accessible control. An explicit `data-fs-suffix` on a file input replaces the automatic cap, text and all. The engine also mirrors the selection state of the control as an `fs-has-file` class on the wrapper. The stylesheet uses the class to gray the browser's no-file text like a placeholder, while a chosen filename keeps normal ink.

Date and time inputs are capped the same way. A `date`, `time`, or `datetime-local` control with no `data-fs-suffix` gets a glyph suffix cap (`fs-picker-date` / `fs-picker-time` / `fs-picker-datetime-local`: a calendar glyph, a clock, and a combined calendar-clock for `datetime-local`) in the accent scheme. Interactive caps wear the accent color like the file cap. Informational caps stay gray. On activation, the cap focuses the control and then calls its `showPicker()`. In a browser with no popup for the type (Safari and Firefox have none for `time`), `showPicker()` is a silent no-op, and the press lands the caret in the field. The cap reads as a jump into the control that it names. A browser that refuses with `NotSupportedError` has its cap demoted instead: the engine marks it `fs-inert`, and it renders as an informational cap. The glyph still identifies the field, while the accent and pointer go. The cap is `aria-hidden`. The input stays the accessible control. The browser's own picker indicator is suppressed inside a caps wrapper, so the field carries one glyph, not two. An `input` with a `list` attribute gets the same treatment (`fs-picker-list`, the caret glyph): its cap opens the suggestion dropdown where the engine supports `showPicker()` for datalists.

### Deselection

The engine makes two native controls deselectable, with no opt-in attribute. A click on a checked radio unchecks it and returns its group to unanswered. Space on a focused checked radio does the same. Arrow-key selection is untouched. A click on the only selected item in a `select[multiple]` list clears the list. Modified clicks (Ctrl, Cmd, Shift) keep their native meanings. Both are client-only affordances. The wire formats are unchanged, and a deselected group submits as unanswered.

A field that is both `required` and authored with a default answer (`checked` on a radio member, `selected` on a multi-select option) keeps its deselection off. Such a field can never legitimately be blank, so the gesture is ignored. The authored attributes decide, not the current state. Thus the markup alone says whether a field deselects. Engine-initiated clearing is unaffected: `data-fs-clear-on-change` still empties such a field, because a stale dependent answer is worse than an empty one.

### Format Hints

A control with a `data-fs-type` and no authored `placeholder` gets the format hint of its type as a placeholder. `zip` gains `##### or #####-####`, `us-dollar` gains `###.##`, and so on for the format-shaped types (`cvv`, `us-phone`, `international-phone`, `ssn`, `duration`). Types whose nature is a description, not a shape, have no hint. An authored `placeholder` always wins. The hint table ships beside the message catalog and is replaceable the same way.

### Character Counter

Any control with `maxlength` gets a live characters-remaining counter, without an opt-in attribute. The engine inserts a `small.fs-counter` immediately after the control and updates it on input. `maxlength` is a native constraint. The counter is the behavior that rides along.

### When Valid

`data-fs-when-valid` makes any element react to the overall validity of the form. The form is valid when no relevant field is `incomplete` or `invalid`.

| Value    | Effect                                              |
|----------|-----------------------------------------------------|
| `hide`   | The element is hidden while the form is valid       |
| `show`   | The element is shown only while the form is valid   |
| `enable` | The element is enabled only while the form is valid |

`hide` suits a readiness message: a "please finish the form" note that disappears once the form is ready.

The common cases need no markup. By default, the engine disables the submit button until the form validates, and renders its own status messages. `data-fs-no-gate` on the form opts out of the button gating. It opts out of the _disabled button_ and nothing else. A submission with outstanding errors is still refused, every error presents, and focus moves to the first offender.

### Message Attributes

`data-fs-label` names a field in its messages. Without it, an implementation falls back to the text of the `label` associated with the control by `for`, then to the first `label` in the row of the field, then to the `name` of the field. Only a real `label` element enters the chain. Thus a row labeled by a `span` — a compound row — needs `data-fs-label`, or the messages land on the raw `name`.

`data-fs-error-to` moves the error bubble of a field. Its value is a CSS selector, resolved within the form. The bubble is a `p`, so the target **MUST be a flow container that may contain a paragraph**: a `div`, not a `p`. When the selector matches nothing, the bubble falls back to the row of the field.

`data-fs-message-incomplete` and `data-fs-message-invalid` on the form override the two standing status lines.

## Presentation Contract

A client engine owns error presentation. This section fixes the DOM that it writes and the classes that it toggles, so site CSS and site scripts can rely on them. Nothing here concerns a server parser.

### Form-Level Marks

At initialization, the engine sets `novalidate` on the form, because it presents errors itself. It adds the class `fs-form`, which scopes the shipped stylesheet to the forms that the engine has taken over. While every relevant field is valid, the form also carries `fs-all-valid`.

### Error Bubbles

The message of a field renders as a `p.fs-error` with `data-fs-field="<name>"` and a unique `id`. When a `data-fs-error-to` target resolves, the engine appends the bubble inside it. On the field's own row, the bubble sits **immediately after the control** (or after the caps wrapper that holds it), above any author hint that follows. For a field with no row, the bubble is appended inside the closest ancestor `fieldset`. The name on the bubble keeps two fields that share one row from an overwrite of each other's messages.

The control that the message is about receives `aria-invalid="true"` and `aria-describedby` pointing at the `id` of the bubble. Both are removed when the message clears.

A bound quoted in a message speaks the presentation that the person sees, not the value register. The temporal inputs (`time`, `date`, `datetime-local`) hold ISO-shaped `min` and `max` attribute values, but their editing UIs render in the locale of the user: clock convention and date order are the choice of the OS. An engine MUST format a quoted temporal bound the same way (`Intl.DateTimeFormat` in the locale of the user, or equivalent). It MUST never echo the raw attribute value. Beware the classic parsing trap: a date-only string handed to JavaScript's `Date` constructor reads as UTC midnight, and shifts a day in most timezones. Parse the fields and construct a local date.

```html
<p class="fs-error" data-fs-field="email" id="fs-error-1">must be an email address</p>
```

### Row Classes

The engine toggles exactly one of three verdict classes on the row of a field, or on the fallback `fieldset`. It also toggles two independent classes: missing and relevance.

| Class           | Meaning                                                               |
|-----------------|-----------------------------------------------------------------------|
| `fs-valid`      | The row's fields are all valid                                        |
| `fs-incomplete` | The worst verdict on the row is `incomplete`                          |
| `fs-invalid`    | The worst verdict on the row is `invalid`                             |
| `fs-missing`    | A field on the row has an unanswered obligation (a requiredness code) |
| `fs-irrelevant` | The row is hidden because its field is irrelevant                     |

The asterisk is a **requiredness indicator**, drawn from `fs-missing` alone. It marks a required question without an answer: an empty required field, an unsatisfied group, an under-count selection. It disappears the moment the obligation is met. A _wrong_ answer is not missing: it gets the error bubble and never the mark. The two vocabularies are disjoint.

### Status Region

The engine makes sure that a `div.fs-status` with `aria-live="polite"` exists. It inserts the region before the submit control, or before the last element child of the form when the form has no submit control. An author MAY place `div.fs-status` anywhere in the form to control where it lands. The engine adopts it and does not add a second.

The region holds up to four kinds of line, each a `p`.

| Element                  | Purpose                                                                                        |
|--------------------------|------------------------------------------------------------------------------------------------|
| `p.fs-status-incomplete` | Standing line, shown while any relevant field is missing (a requiredness code)                 |
| `p.fs-status-invalid`    | Standing line, shown while any relevant field holds a wrong answer — any other not-valid state |
| `p.fs-status-message`    | The result of a submission: processing, success, or failure                                    |
| `p.fs-status-error`      | One per form-level error returned by the server                                                |

Both standing lines can show at the same time, and each clears as its condition resolves. Their text comes from the message catalog, and `data-fs-message-incomplete` and `data-fs-message-invalid` override it per form.

The region itself carries one submission-state class at a time.

| Class           | State                                   |
|-----------------|-----------------------------------------|
| `fs-processing` | A submission is in flight               |
| `fs-success`    | The server accepted the submission      |
| `fs-error`      | The submission failed or was unreadable |

The region takes an `fs-error` class of its own, so the element name is what tells a form-level banner from a field bubble: a bubble is always `p.fs-error`, and the region is always `div.fs-status`.

### Engine-Written Elements

Three more engine-written structures, all covered above: the `span.fs-caps` wrapper (with `span.fs-prefix` / `span.fs-suffix` children) around a capped or reveal-bearing control, `button.fs-reveal` after a `data-fs-reveal` password input, and `small.fs-counter` after a `maxlength` control.

### Theming Knobs

The shipped stylesheet lives in `@layer formsanity`. Thus unlayered site CSS outranks every rule in it without a specificity fight. The library is framework CSS from the point of view of a site. Its custom properties are public API, with the same compatibility guarantees as the attributes in this document. Redefine them on the form or on any ancestor.

| Property                       | Default                 | Governs                                            |
|--------------------------------|-------------------------|----------------------------------------------------|
| `--fs-font-family`             | `system-ui, sans-serif` | The form's typeface                                |
| `--fs-font-size`               | `1rem`                  | The form's base size                               |
| `--fs-gap`                     | `0.75rem`               | Spacing between rows and between compound controls |
| `--fs-column-gap`              | `2rem`                  | The gutter between columns in an `fs-cols` group   |
| `--fs-label-gap`               | `0.25em`                | The gap between a left label and its control       |
| `--fs-label-width`             | `max-content`           | The left-label column's track size                 |
| `--fs-control-padding`         | `0.4em 0.75em`          | Padding inside every box-like control              |
| `--fs-border-color`            | `hsl(0 0% 75%)`         | Control and fieldset borders                       |
| `--fs-border-radius`           | `0.25rem`               | Corner rounding throughout                         |
| `--fs-section-bkg`             | `hsl(0 0% 97%)`         | Outer fieldset background and derived border       |
| `--fs-focus-color`             | `hsl(210 80% 55%)`      | The focus ring                                     |
| `--fs-label-color`             | `inherit`               | Row label text                                     |
| `--fs-annotation-color`        | `hsl(0 0% 40%)`         | Annotations, counters, section prose               |
| `--fs-asterisk-color`          | `hsl(0 85% 40%)`        | The requiredness asterisk                          |
| `--fs-asterisk-size`           | `0.5em`                 | The requiredness asterisk's width                  |
| `--fs-error-bkg`               | `hsl(0 85% 40%)`        | Error bubble background                            |
| `--fs-error-color`             | `white`                 | Error bubble text                                  |
| `--fs-status-incomplete-color` | `hsl(0 0% 25%)`         | The standing incomplete line                       |
| `--fs-status-invalid-bkg`      | `hsl(0 85% 40%)`        | Red status banners                                 |
| `--fs-status-invalid-color`    | `white`                 | Red status banner text                             |
| `--fs-status-success-bkg`      | `hsl(146 50% 36%)`      | The success bar and its derived border             |
| `--fs-status-success-color`    | `white`                 | Success bar text                                   |
| `--fs-disabled-opacity`        | `0.5`                   | Disabled controls and irrelevant rows              |
| `--fs-toggle-accent`           | `hsl(210 80% 42%)`      | Checked toggles and selected buttons               |
| `--fs-toggle-border-color`     | `hsl(0 0% 56%)`         | Unchecked toggle indicator borders                 |
| `--fs-transition-duration`     | `150ms`                 | Color and opacity state changes                    |

The knob set is closed. Anything without a knob is restyled with an unlayered site rule, which outranks the layer without a specificity fight.

### Breakpoints

Two container-query breakpoints govern the layout. Both are fixed lengths, not knobs, because the condition of a size query cannot read a custom property.

| Breakpoint | Length  | Effect below it                                   |
|------------|---------|---------------------------------------------------|
| Left label | `32rem` | Labels sit above their controls instead of beside |
| Columns    | `52rem` | An `fs-cols` group collapses to a single column   |

Each breakpoint is decided in exactly one rule. That rule sets a group of `--_fs-*` **row switches** that the rest of the stylesheet reads. Those two switch groups are the supported override mechanism: an override restates the switch declarations at a new length. The seven switches in the tables below are stable, and overrides MAY rely on them. The same applies to the `--_fs-mode-*` switches that the shipped rules assign from. An override that must respect the `fs-stacked`/`fs-inline` cascade assigns from those (`--_fs-label-justify: var(--_fs-mode-justify)`, and so on) instead of a restatement of the wide literals, which pin the inline look. Every other `--_fs-*` property in the stylesheet is internal machinery, and can be renamed without notice.

The left-label breakpoint sets these four.

| Switch                 | Narrow value | Wide value                  |
|------------------------|--------------|-----------------------------|
| `--_fs-label-justify`  | `stretch`    | `end`                       |
| `--_fs-label-align`    | `left`       | `right`                     |
| `--_fs-label-pad`      | `0`          | `var(--fs-control-padding)` |
| `--_fs-control-column` | `1`          | `2`                         |

The columns breakpoint sets these three, on the `.fs-cols` group only.

| Switch             | Narrow value | Wide value   |
|--------------------|--------------|--------------|
| `--_fs-row-span`   | `1 / -1`     | `span 2`     |
| `--_fs-column-one` | `1 / -1`     | `1 / span 2` |
| `--_fs-column-two` | `1 / -1`     | `3 / span 2` |

The narrow values are the defaults of the stylesheet, declared once on `.fs-form`. A breakpoint rule only ever states the wide set.

A moved breakpoint means a restated rule on **both** sides of the new length. Both, because the shipped rule still applies at its own length: an override that names only the new length leaves two breakpoints, not a moved one. To move left labels from `32rem` to `40rem`:

```css
@container fs-group (width < 40rem) {
	.fs-form fieldset:not(.fs-toggles) > ul {
		grid-template-columns: minmax(0, 1fr);
		--_fs-label-justify: stretch;
		--_fs-label-align: left;
		--_fs-label-pad: 0;
		--_fs-control-column: 1;
	}
}
@container fs-group (width >= 40rem) {
	.fs-form fieldset:not(.fs-toggles) > ul {
		grid-template-columns: var(--fs-label-width) minmax(0, 1fr);
		--_fs-label-justify: end;
		--_fs-label-align: right;
		--_fs-label-pad: var(--fs-control-padding);
		--_fs-control-column: 2;
	}
}
```

Freeform rows carry the same four label switches in a rule of their own. Move their breakpoint the same way, with `.fs-form div[data-fs-field]` as the subject and an unnamed `@container`.

The columns breakpoint moves by the same two-sided restatement, with its own three switches. To move it from `52rem` to `64rem`:

```css
@container fs-group (width < 64rem) {
	.fs-form fieldset:not(.fs-toggles) > ul.fs-cols {
		--_fs-row-span: 1 / -1;
		--_fs-column-one: 1 / -1;
		--_fs-column-two: 1 / -1;
	}
}
@container fs-group (width >= 64rem) {
	.fs-form fieldset:not(.fs-toggles) > ul.fs-cols {
		grid-template-columns: var(--fs-label-width) minmax(0, 1fr) var(--fs-label-width) minmax(0, 1fr);
		column-gap: var(--fs-column-gap);
		--_fs-row-span: span 2;
		--_fs-column-one: 1 / span 2;
		--_fs-column-two: 3 / span 2;
	}
}
```

The narrow block is what undoes the shipped `52rem` rule between `52rem` and `64rem`. Without it, the group goes two-column at the old length, and the override adds a breakpoint instead of a move. The `div.fs-cols` wrapper rule tests the same length. Thus an override that moves this breakpoint also restates its `grid-template-columns` and `column-gap` at the new length.

The form is a query container named `fs-form`, and every `fieldset` is one named `fs-group`. The container of a group sits on the `fieldset`. Thus the `ul` and its `li` children resolve the same container, and cannot disagree about which side of a breakpoint they are on.

## Events

A client engine dispatches these `CustomEvent`s, so site code can observe a form without patches to the library. All bubble. **A server parser has nothing to do with this section.**

| Event              | Target                    | `detail`                  | Fired when                                                 |
|--------------------|---------------------------|---------------------------|------------------------------------------------------------|
| `fs:init`          | The `form`                | `{ model }`               | The engine finishes wiring the form                        |
| `fs:field-valid`   | The field's first control | `{ name, verdict, code }` | A field's verdict changes to `valid`                       |
| `fs:field-invalid` | The field's first control | `{ name, verdict, code }` | A field's verdict changes to `invalid`                     |
| `fs:submit`        | The `form`                | `{ payload }`             | Validation and pre-submit hooks passed, before the request |
| `fs:accepted`      | The `form`                | `{ envelope }`            | The server accepted the submission                         |
| `fs:rejected`      | The `form`                | `{ envelope }`            | The server rejected it on validation                       |
| `fs:error`         | The `form`                | `{ envelope }`            | The submission failed or the envelope was unreadable       |

`fs:field-valid` and `fs:field-invalid` fire only on a change into those two states. A field that settles into `incomplete` fires neither. `code` is `null` on `fs:field-valid`.

A pre-submit hook registered through the engine's `addPreSubmitHook` API can contribute extra fields to the payload, or abort the submission. Payment and captcha tokens travel that way, and the library never learns what they mean. A hook that aborts fires no event, because no envelope exists.

## Layout Classes

Layout lives in classes, which servers ignore. Validation semantics live in `data-fs-*` attributes, which servers parse. **This entire section is non-normative for a server parser.** It is documented because the shipped stylesheet implements it and authors write it.

| Class          | Host                                        | Effect                                                                 |
|----------------|---------------------------------------------|------------------------------------------------------------------------|
| `fs-stacked`   | A row, a field group `ul`, or the `form`    | Stacked labels — label above its content — for the element and everything inside it |
| `fs-inline`    | A row or a field group `ul`                 | Inline labels — label beside its content — restoring the default inside a stacked scope |
| `fs-inline`    | With `fs-toggles`, inside a row `li`        | The legend joins the shared label column, choices sit beside it        |
| `fs-cols`      | A field group `ul`                          | Lays the group's rows into two label/control column pairs              |
| `fs-cols`      | A `div` inside a section                    | Pairs non-row content — toggle fieldsets, stacked rows — two-up when wide |
| `fs-col-start` | A row inside an `fs-cols` group             | The second column starts at this row                                   |
| `fs-compound`  | A wrapper inside a row                      | Lays several controls sharing one label side by side                   |
| `fs-toggles`   | A choice-group `fieldset`                   | The styled checkbox and radio treatment                                |
| `fs-buttons`   | With `fs-toggles`                           | Renders each choice as a toggle button instead of a box and a label    |

`fs-stacked` and `fs-inline` **cascade**: the nearest declaration wins. A row's class wins over its group's, a group's over the form's, and the form's over the default (inline labels). Both select the wide presentation only. Below the left-label breakpoint, every label stacks, because stacking is the layout that a narrow container always affords. An `fs-inline` row inside a stacked group lays out on its own grid. Thus its label column sizes to that row alone, as the label column of a freeform row does.

In the `fs-buttons` variant, radio groups render as one segmented control. The engine marks them `fs-segmented`, and physically joined buttons read as mutually exclusive. Checkbox groups stay separated, independent buttons. A segmented group that cannot fit on one line gets an engine-measured `fs-wrapped` class and falls apart into separated pills, still distinct from the checkbox rectangles. Both classes are engine-written presentation state, like the row state classes.

`fs-col-start` means that the second column starts at this row, whether the author wrote the class or the engine did. An inline-mode `fs-cols` group with no authored `fs-col-start` **auto-balances**: the engine adds the class to the midpoint row of the group at init, and the columns fill top to bottom on either side of it. The balance counts non-`fs-stacked` rows once, at init. A row later hidden by relevance can leave the columns visually uneven.

With an `fs-col-start` present, the split is explicit. Every row before it stacks in the first column. It and every row after it stack in the second. An `fs-stacked` row inside a wide inline `fs-cols` group is one label/control pair wide, so two stacked rows sit side by side.

An `fs-cols` group whose effective mode is stacked pairs whole rows on two equal tracks, in reading order, and each row stacks internally. Such a group has no top-to-bottom columns, so the engine's auto-balance skips it.

## Attribute Index

Every attribute this specification defines, and who reads it.

| Attribute                         | Host                       | Register  | Server parser |
|-----------------------------------|----------------------------|-----------|---------------|
| `data-fs-form`                    | `form`                     | Structure | Reads         |
| `data-fs-field`                   | A row wrapper              | Structure | Reads         |
| `data-fs-type`                    | A control                  | Rule      | Reads         |
| `data-fs-type-param`              | A control                  | Rule      | Reads         |
| `data-fs-min-digits`              | A control                  | Rule      | Reads         |
| `data-fs-min-uppercase`           | A control                  | Rule      | Reads         |
| `data-fs-min-lowercase`           | A control                  | Rule      | Reads         |
| `data-fs-min-selected`            | Any member of a set        | Rule      | Reads         |
| `data-fs-max-selected`            | Any member of a set        | Rule      | Reads         |
| `data-fs-group-required-any`      | Any member of a set        | Rule      | Reads         |
| `data-fs-group-required-together` | Any member of a set        | Rule      | Reads         |
| `data-fs-group-unique-values`     | Every member of the group  | Rule      | Reads         |
| `data-fs-unique`                  | A control                  | Rule      | Reads         |
| `data-fs-max-file-size`           | A file control             | Rule      | Reads         |
| `data-fs-min`                     | An ordered-type control    | Rule      | Reads         |
| `data-fs-max`                     | An ordered-type control    | Rule      | Reads         |
| `data-fs-min-time`                | A `datetime-local` control | Rule      | Reads         |
| `data-fs-max-time`                | A `datetime-local` control | Rule      | Reads         |
| `data-fs-constraint`              | A control                  | Rule      | Reads         |
| `data-fs-constraint-message`      | A control                  | Rule      | Reads         |
| `data-fs-relevant`                | Any control of a field     | Relevance | Reads         |
| `data-fs-irrelevant`              | Any control of a field     | Relevance | Reads         |
| `data-fs-copy-to`                 | A control                  | Behavior  | Ignores       |
| `data-fs-amount`                  | A control                  | Behavior  | Ignores       |
| `data-fs-amount-total`            | Any element                | Behavior  | Ignores       |
| `data-fs-year-options`            | `select`                   | Behavior  | Ignores       |
| `data-fs-month-options`           | `select`                   | Behavior  | Ignores       |
| `data-fs-prefix`                  | A control                  | Behavior  | Ignores       |
| `data-fs-suffix`                  | A control                  | Behavior  | Ignores       |
| `data-fs-reveal`                  | A password input           | Behavior  | Ignores       |
| `data-fs-clear-on-change`         | A control                  | Behavior  | Ignores       |
| `data-fs-when-valid`              | Any element                | Behavior  | Ignores       |
| `data-fs-no-gate`                 | `form`                     | Behavior  | Ignores       |
| `data-fs-message-incomplete`      | `form`                     | Behavior  | Ignores       |
| `data-fs-message-invalid`         | `form`                     | Behavior  | Ignores       |
| `data-fs-label`                   | A control                  | Behavior  | Ignores       |
| `data-fs-error-to`                | A control                  | Behavior  | Ignores       |

The engine writes `data-fs-field="<name>"` onto the error bubbles that it creates. A server parser that reads authored markup never encounters those. It MUST treat `data-fs-field` on a `p.fs-error` as an engine internal, not a row boundary.
