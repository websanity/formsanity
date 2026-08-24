# The FormSanity Reference

Every authored attribute, alphabetically, then the quick tables: field types, layout classes, and events. Each entry links to the section of the [vocabulary spec](../specs/vocabulary.md) that defines it precisely; the spec is the authority wherever an entry summarizes. New to FormSanity? Read the [guide](guide.md) first.

Native HTML attributes (`required`, `minlength`, `maxlength`, `min`, `max`, `step`, `pattern`, `accept`, and the input types) are half the vocabulary and always preferred where they can express the rule; see [Native Register](../specs/vocabulary.md#native-register).

## Attributes

### `data-fs-amount`

Marks a control (or a select's `option`) as a term in the form's running total. Bare, it reads the control's own value as the amount; with a value, that value is a price the control charges while checked or selected — multiplied by the answer on a quantity control. Negative prices are discounts.

`<input type="checkbox" name="gift-wrap" value="yes" data-fs-amount="5">`

_Spec: [Amount Totals](../specs/vocabulary.md#amount-totals)_

### `data-fs-amount-total`

Marks an element as a destination for the form's total; every term sums into it live. On a form control the sum becomes its value, on any other element its text. Show the total in an `<output>` and post it through a hidden input, both marked.

`<output data-fs-amount-total></output>`

_Spec: [Amount Totals](../specs/vocabulary.md#amount-totals)_

### `data-fs-clear-on-change`

Empties this control whenever any of the named source fields changes — for dependent answers that a source change makes stale. The value is one or more field names, space-separated. Goes on any control.

`<select name="state" data-fs-clear-on-change="country">`

_Spec: [Clear on Change](../specs/vocabulary.md#clear-on-change)_

### `data-fs-constraint`

Holds an expression that must be true for this field's answer to be acceptable — the vocabulary's whole comparison surface. Goes on the field it judges, which the expression names by its own `name`. One per field; join conditions with `&&`.

`<input name="confirm" type="password" data-fs-constraint="confirm == password" data-fs-constraint-message="Passwords do not match.">`

_Spec: [Constraint Expressions](../specs/vocabulary.md#constraint-expressions), [Expression Grammar](../specs/vocabulary.md#expression-grammar)_

### `data-fs-constraint-message`

The bubble text shown when the constraint on the same control fails. Always write one — nothing readable can be computed from an expression, so the fallback is a generic line.

_Spec: [Constraint Expressions](../specs/vocabulary.md#constraint-expressions)_

### `data-fs-copy-to`

Mirrors this control's answer onto the named field on every input. Text targets take the value; a radio target checks its matching member; a checkbox target mirrors the matching member's checked state. Goes on any control.

`<input name="billing-street" data-fs-copy-to="shipping-street">`

_Spec: [Copy To](../specs/vocabulary.md#copy-to)_

### `data-fs-error-to`

Moves this field's error bubble into the element matched by the value, a CSS selector resolved within the form. The target must be able to contain a paragraph — a `div`, not a `p`. Falls back to the field's row when nothing matches.

`<input name="promo" data-fs-error-to="#promo-errors">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-field`

Marks any wrapper element as a field row, for layouts the document grammar doesn't cover. Takes no value. The wrapper holds the label and its control, like an `li` would.

`<div data-fs-field><label for="q">Search</label><input id="q" name="q"></div>`

_Spec: [Freeform Rows](../specs/vocabulary.md#freeform-rows)_

### `data-fs-form`

Opts a form in; the engine touches only forms carrying it. Takes no value. Goes on the `form` element, whose `action` is the submission endpoint.

`<form data-fs-form action="/api/join" method="post">`

_Spec: [Opting In](../specs/vocabulary.md#opting-in)_

### `data-fs-group-required-any`, `data-fs-group-required-together`

Requiredness across fields. Fields sharing a group name form the group: `required-any` means at least one member must be answered; `required-together` means all or none. The value is a group name you invent. Goes on each member control.

`<input name="home-phone" data-fs-type="us-phone" data-fs-group-required-any="phone">`

_Spec: [Groups](../specs/vocabulary.md#groups)_

### `data-fs-group-unique-values`

Requires the members of the named group to hold mutually distinct values — first choice and second choice may not be the same. Empty values never collide. Goes on each member control.

`<select name="first-choice" data-fs-group-unique-values="choices">`

_Spec: [Uniqueness](../specs/vocabulary.md#uniqueness)_

### `data-fs-irrelevant`

How this field (or region) presents while irrelevant: `hidden` (the default) removes it, `disabled` keeps it in place, grayed. Goes wherever `data-fs-relevant` goes.

`<input name="other-color" data-fs-relevant="color == 'Other'" data-fs-irrelevant="disabled">`

_Spec: [Relevance](../specs/vocabulary.md#relevance)_

### `data-fs-label`

Names the field in its messages, replacing the visible label text. Needed on compound-row controls, whose shared label the naming chain can't see. Goes on any control.

`<input name="first-name" aria-labelledby="name-label" data-fs-label="First name">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-max-file-size`

Caps each selected file's size. The value is a number and a unit: `500b`, `1.5MB`, `2 GB`. Goes on a file control; pair it with native `accept` for the type filter.

`<input name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">`

_Spec: [Files](../specs/vocabulary.md#files)_

### `data-fs-min`, `data-fs-max`

Value bounds for the two fs types that define an ordering — `duration` and `us-dollar` — written in the type's own format. (Native types use native `min`/`max`.) Go on the typed control.

`<input name="runtime" data-fs-type="duration" data-fs-min="0:30" data-fs-max="4:00">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-min-digits`, `data-fs-min-uppercase`, `data-fs-min-lowercase`

Password composition: at least _n_ characters of the class. Each value is a positive integer. Go on the password control, usually alongside `minlength`.

`<input name="password" type="password" minlength="10" data-fs-min-digits="1">`

_Spec: [Password Composition](../specs/vocabulary.md#password-composition)_

### `data-fs-min-selected`, `data-fs-max-selected`

Bound how many members of a checkbox set or `select multiple` may be chosen. `min-selected="1"` is also the right way to require a checkbox set. Either goes on any member of the set (or the `select` itself).

`<input type="checkbox" name="toppings" value="pepperoni" data-fs-min-selected="1" data-fs-max-selected="2">`

_Spec: [Selection Counts](../specs/vocabulary.md#selection-counts)_

### `data-fs-min-time`, `data-fs-max-time`

Bound the time-of-day component of a `datetime-local` control — "business hours on any day in the span" — while native `min`/`max` bound the span itself. Each value is a 24-hour `HH:MM`; a reversed pair wraps midnight.

`<input name="meeting" type="datetime-local" data-fs-min-time="09:00" data-fs-max-time="17:00">`

_Spec: [Daily Time Windows](../specs/vocabulary.md#daily-time-windows)_

### `data-fs-message-incomplete`, `data-fs-message-invalid`

Reword the form's two standing status lines — "something is unanswered" and "something is wrong". Go on the `form`.

`<form data-fs-form data-fs-message-invalid="Please fix the highlighted answers.">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-month-options`, `data-fs-year-options`

Generate a select's options at load, offset from the current month or year: `from,to` in whole months or years, either direction. Month options are a rolling window that wraps the year boundary. Static placeholder options stay first. Go on a `select`.

`<select name="expiry-year" data-fs-year-options="0,10"></select>`

_Spec: [Generated Date Options](../specs/vocabulary.md#generated-date-options)_

### `data-fs-no-gate`

Keeps the submit button enabled before the form is valid. Only the disabled button is opted out: submission with errors is still refused, every error presents, and focus lands on the first problem. Takes no value; goes on the `form`.

_Spec: [When Valid](../specs/vocabulary.md#when-valid)_

### `data-fs-prefix`, `data-fs-suffix`

Render the value as a small cap fused to the control's box — a `$`, a unit, a domain. Purely visual: never part of the answer, and not announced to assistive technology. Go on any control. File, date, and time controls get an automatic suffix cap without them.

`<input name="price" data-fs-type="us-dollar" data-fs-prefix="$">`

_Spec: [Caps](../specs/vocabulary.md#caps)_

### `data-fs-relevant`

Conditional participation. On a control: the field takes part — validated, submitted, visible — only while the expression is true. On any other element: a region, governing every field inside it with one expression; nested conditions combine with AND. The value is an expression in the same language constraints use.

`<input name="other-color" required data-fs-relevant="color == 'Other'">`

_Spec: [Relevance](../specs/vocabulary.md#relevance), [Relevance Regions](../specs/vocabulary.md#relevance-regions)_

### `data-fs-reveal`

Adds the show/hide eye toggle to a password input. Takes no value. Declare `autocomplete="new-password"` or `current-password` alongside.

`<input name="password" type="password" autocomplete="new-password" data-fs-reveal>`

_Spec: [Password Reveal](../specs/vocabulary.md#password-reveal)_

### `data-fs-type`

Names a format HTML has no input type for; the value is one name from the type catalog below. Goes on a control, which stays `type="text"` (or `type="tel"` for the phone types). A wrong answer reports `type.<name>`.

`<input name="phone" type="tel" data-fs-type="us-phone" autocomplete="tel">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-type-param`

A type's parameter; only `credit-card` reads one — the allowed networks, `|`-separated. Goes with `data-fs-type` on the control.

`<input name="card" data-fs-type="credit-card" data-fs-type-param="Visa|MasterCard">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-unique`

Asks the server whether the value is already taken, as the person leaves the field; the value is the check endpoint's URL. Advisory only — the server's check at submission decides. Goes on a control.

`<input name="username" data-fs-type="identifier" data-fs-unique="/api/unique">`

_Spec: [Uniqueness](../specs/vocabulary.md#uniqueness), [protocol](../specs/submission-protocol.md#uniqueness-sub-protocol)_

### `data-fs-when-valid`

Makes any element react to the whole form's validity: `hide` hides it while the form is valid (a "please finish" note), `show` is the inverse, `enable` enables it only when valid. Goes on any element.

`<p data-fs-when-valid="hide">Almost there — finish the highlighted questions.</p>`

_Spec: [When Valid](../specs/vocabulary.md#when-valid)_

## Field Types

The catalog for `data-fs-type`, loosely: exact acceptance rules are the spec's [Field Types](../specs/vocabulary.md#field-types) tables. Types marked with a tidied form rewrite a valid answer into it when the person leaves the field.

| Type                  | Accepts                                              | Tidied form           |
| --------------------- | ---------------------------------------------------- | --------------------- |
| `alpha`               | Letters only                                         |                       |
| `alphanum`            | Letters and digits                                   |                       |
| `identifier`          | Letters, digits, `_`, `-`                            |                       |
| `no-whitespace`       | Anything but whitespace                              |                       |
| `email`               | An address with a real domain (dot required)         |                       |
| `email-list`          | Addresses separated by commas or whitespace          |                       |
| `us-phone`            | US numbers in common punctuation                     | `(303) 555-1234`      |
| `international-phone` | 7–15 digits, common punctuation                      | `+442079460958`       |
| `zip`                 | ZIP or ZIP+4                                         | `80210` / `80210-1234`|
| `ssn`                 | Nine digits, with or without separators              | `123-45-6789`         |
| `us-dollar`           | Dollar amounts, `$` and commas welcome               | `1234.50`             |
| `duration`            | Minutes (`90`) or `H:MM` (`1:30`)                    | `1:30`                |
| `credit-card`         | Card numbers for the networks in the param           |                       |
| `cvv`                 | Three or four digits                                 |                       |
| `ip`, `ipv4`, `ipv6`  | Network addresses, either or one family              |                       |

## Layout Classes

Presentation only — a validating server ignores them. The stylesheet's contract is the spec's [Layout Classes](../specs/vocabulary.md#layout-classes) section.

| Class         | Where                       | Effect                                              |
| ------------- | --------------------------- | --------------------------------------------------- |
| `block`       | A row                       | Label above a full-width control                    |
| `cols`        | A field group `ul`          | Two-column layout for the group's rows              |
| `col-break`   | A row in a `cols` group     | Starts the second column here (default: midpoint)   |
| `compound`    | A wrapper inside a row      | Controls side by side under one shared label        |
| `toggle-list` | A choice-group `fieldset`   | The styled checkbox and radio treatment             |
| `row`         | With `toggle-list`, in a row | Legend in the label column, choices beside it      |
| `buttons`     | With `toggle-list`          | Choices as toggle buttons                           |

## Events

Site code observes a form through bubbling `fs:` events: `fs:init`, `fs:field-valid`, `fs:field-invalid`, `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error`. Targets, payloads, and timing are in the spec's [Events](../specs/vocabulary.md#events) table. Extra submission fields (captcha and payment tokens) go through `addPreSubmitHook(form, fn)` instead — see the [guide's submitting chapter](guide.md#10-submitting).

## Theming

All knobs — the custom properties, their defaults, and what each governs — are tabled in the spec's [Theming Knobs](../specs/vocabulary.md#theming-knobs) section, and the two responsive breakpoints and their override recipe in [Breakpoints](../specs/vocabulary.md#breakpoints).
