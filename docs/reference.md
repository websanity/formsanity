# The FormSanity Reference

Every authored attribute, in alphabetical order, then the quick tables: field types, layout classes, and events. Each entry links to the section of the [vocabulary spec](../specs/vocabulary.md) that defines it precisely. Where an entry summarizes, the spec is the authority. New to FormSanity? Read the [guide](guide.md) first.

Native HTML attributes (`required`, `minlength`, `maxlength`, `min`, `max`, `step`, `pattern`, `accept`, and the input types) are half the vocabulary. Where a native attribute can state the rule, use it. See [Native Register](../specs/vocabulary.md#native-register).

## Attributes

### `data-fs-amount`

Marks a control, or an `option` of a select, as a term in the live total of the form. Bare, it reads the value of its own control as the amount. With a value, that value is a price. The control adds the price while checked or selected. On a quantity control, the price multiplies by the answer. A negative price is a discount.

`<input type="checkbox" name="gift-wrap" value="yes" data-fs-amount="5">`

_Spec: [Amount Totals](../specs/vocabulary.md#amount-totals)_

### `data-fs-amount-total`

Marks an element as a destination for the total of the form. Every term sums into it live. On a form control, the sum becomes the value. On any other element, the sum becomes the text. Show the total in an `<output>` and post it through a hidden input. Mark both.

`<output data-fs-amount-total></output>`

_Spec: [Amount Totals](../specs/vocabulary.md#amount-totals)_

### `data-fs-clear-on-change`

Empties this control when a named source field changes. Use it for dependent answers that a source change makes stale. The value is one or more field names, with spaces between them. Goes on any control.

`<select name="state" data-fs-clear-on-change="country">`

_Spec: [Clear on Change](../specs/vocabulary.md#clear-on-change)_

### `data-fs-constraint`

Holds an expression that must be true for an acceptable answer. This is the full comparison surface of the vocabulary. Goes on the field that it judges. The expression names that field by its own `name`. Each field takes one constraint. Join conditions with `&&`.

`<input name="confirm" type="password" data-fs-constraint="confirm == password" data-fs-constraint-message="Passwords do not match.">`

_Spec: [Constraint Expressions](../specs/vocabulary.md#constraint-expressions), [Expression Grammar](../specs/vocabulary.md#expression-grammar)_

### `data-fs-constraint-message`

The bubble text for a failed constraint on the same control. Always write one. The engine cannot compute a readable sentence from an expression. The fallback is a generic line.

_Spec: [Constraint Expressions](../specs/vocabulary.md#constraint-expressions)_

### `data-fs-copy-to`

Copies the answer of this control to the named field on every input. A text target takes the value. A radio target checks its matching member. A checkbox target copies the checked state of the matching member. Goes on any control.

`<input name="billing-street" data-fs-copy-to="shipping-street">`

_Spec: [Copy To](../specs/vocabulary.md#copy-to)_

### `data-fs-error-to`

Moves the error bubble of this field into the element that the value matches. The value is a CSS selector, resolved in the form. The target must be able to contain a paragraph: a `div`, not a `p`. When nothing matches, the bubble stays in the row of the field.

`<input name="promo" data-fs-error-to="#promo-errors">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-field`

Marks a wrapper element as a field row, for layouts that the document structure does not cover. Takes no value. The wrapper holds the label and its control, like an `li`.

`<div data-fs-field><label for="q">Search</label><input id="q" name="q"></div>`

_Spec: [Freeform Rows](../specs/vocabulary.md#freeform-rows)_

### `data-fs-form`

Opts a form in. The engine touches only forms with this attribute. Takes no value. Goes on the `form` element. The `action` of the form is the submission endpoint.

`<form data-fs-form action="/api/join" method="post">`

_Spec: [Opting In](../specs/vocabulary.md#opting-in)_

### `data-fs-group-required-any`, `data-fs-group-required-together`

Requiredness across fields. Fields that share a group name form the group. `required-any` means: the person must answer at least one member. `required-together` means: the person must answer all members, or none. The value is a group name that you invent. Goes on each member control.

`<input name="home-phone" data-fs-type="us-phone" data-fs-group-required-any="phone">`

_Spec: [Groups](../specs/vocabulary.md#groups)_

### `data-fs-group-unique-values`

Requires different values in the members of the named group. A first choice and a second choice cannot be the same. Empty values never collide. Goes on each member control.

`<select name="first-choice" data-fs-group-unique-values="choices">`

_Spec: [Uniqueness](../specs/vocabulary.md#uniqueness)_

### `data-fs-irrelevant`

Selects how this field or region presents while irrelevant. `hidden`, the default, removes it. `disabled` keeps it in place, grayed. Goes where `data-fs-relevant` goes.

`<input name="other-color" data-fs-relevant="color == 'Other'" data-fs-irrelevant="disabled">`

_Spec: [Relevance](../specs/vocabulary.md#relevance)_

### `data-fs-label`

Names the field in its messages, in place of the visible label text. Compound-row controls need it, because the naming chain cannot see their shared label. Goes on any control.

`<input name="first-name" aria-labelledby="name-label" data-fs-label="First name">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-max-file-size`

Limits the size of each selected file. The value is a number and a unit: `500b`, `1.5MB`, `2 GB`. Goes on a file control. Pair it with native `accept` for the type filter.

`<input name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">`

_Spec: [Files](../specs/vocabulary.md#files)_

### `data-fs-min`, `data-fs-max`

Value limits for the two fs types with an order: `duration` and `us-dollar`. Write the limit in the format of the type. Native types use native `min` and `max`. Go on the typed control.

`<input name="runtime" data-fs-type="duration" data-fs-min="0:30" data-fs-max="4:00">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-min-digits`, `data-fs-min-uppercase`, `data-fs-min-lowercase`

Password composition: at least _n_ characters of the class. Each value is a positive integer. Go on the password control, usually with `minlength`.

`<input name="password" type="password" minlength="10" data-fs-min-digits="1">`

_Spec: [Password Composition](../specs/vocabulary.md#password-composition)_

### `data-fs-min-selected`, `data-fs-max-selected`

Limit how many members of a checkbox set or a `select multiple` the person can choose. `min-selected="1"` is also the correct way to require a checkbox set. Either attribute goes on any member of the set, or on the `select` itself.

`<input type="checkbox" name="toppings" value="pepperoni" data-fs-min-selected="1" data-fs-max-selected="2">`

_Spec: [Selection Counts](../specs/vocabulary.md#selection-counts)_

### `data-fs-min-time`, `data-fs-max-time`

Limit the time-of-day part of a `datetime-local` control, for example business hours on each day in the span. Native `min` and `max` limit the span itself. Each value is a 24-hour `HH:MM`. A reversed pair wraps around midnight.

`<input name="meeting" type="datetime-local" data-fs-min-time="09:00" data-fs-max-time="17:00">`

_Spec: [Daily Time Windows](../specs/vocabulary.md#daily-time-windows)_

### `data-fs-message-incomplete`, `data-fs-message-invalid`

Replace the two standing status lines of the form: "something is unanswered" and "something is wrong". Go on the `form`.

`<form data-fs-form data-fs-message-invalid="Please fix the highlighted answers.">`

_Spec: [Message Attributes](../specs/vocabulary.md#message-attributes)_

### `data-fs-month-options`, `data-fs-year-options`

Generate the options of a select at load, offset from the current month or year. The value is `from,to`, in whole months or years, in either direction. Month options are a moving window that wraps the year boundary. Static placeholder options stay first. Go on a `select`.

`<select name="expiry-year" data-fs-year-options="0,10"></select>`

_Spec: [Generated Date Options](../specs/vocabulary.md#generated-date-options)_

### `data-fs-no-gate`

Keeps the submit button enabled before the form is valid. Only the disabled button goes away. The engine still refuses a submission with errors, shows every error, and focuses the first problem. Takes no value. Goes on the `form`.

_Spec: [When Valid](../specs/vocabulary.md#when-valid)_

### `data-fs-prefix`, `data-fs-suffix`

Show the value as a small cap attached to the box of the control: a `$`, a unit, a domain. Caps are visual only. They are never part of the answer, and assistive technology does not announce them. Go on any control. File, date, and time controls get an automatic suffix cap without them.

`<input name="price" data-fs-type="us-dollar" data-fs-prefix="$">`

_Spec: [Caps](../specs/vocabulary.md#caps)_

### `data-fs-relevant`

Conditional participation. On a control: the field takes part (validated, submitted, visible) only while the expression is true. On any other element: the element is a region, and one expression controls every field in it. Nested conditions combine with AND. The value is an expression in the same language that constraints use.

`<input name="other-color" required data-fs-relevant="color == 'Other'">`

_Spec: [Relevance](../specs/vocabulary.md#relevance), [Relevance Regions](../specs/vocabulary.md#relevance-regions)_

### `data-fs-reveal`

Adds the show/hide toggle to a password input. Takes no value. Also declare `autocomplete="new-password"` or `current-password`.

`<input name="password" type="password" autocomplete="new-password" data-fs-reveal>`

_Spec: [Password Reveal](../specs/vocabulary.md#password-reveal)_

### `data-fs-type`

Names a format that HTML has no input type for. The value is one name from the type catalog below. Goes on a control. The control stays `type="text"`, or `type="tel"` for the phone types. A wrong answer reports `type.<name>`.

`<input name="phone" type="tel" data-fs-type="us-phone" autocomplete="tel">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-type-param`

A parameter for the type. Only `credit-card` reads one: the permitted networks, with `|` between them. Goes with `data-fs-type` on the control.

`<input name="card" data-fs-type="credit-card" data-fs-type-param="Visa|MasterCard">`

_Spec: [Field Types](../specs/vocabulary.md#field-types)_

### `data-fs-unique`

Asks the server if the value is already taken, when the person leaves the field. The value is the URL of the check endpoint. The answer is advisory only. The server's check at submission decides. Goes on a control.

`<input name="username" data-fs-type="identifier" data-fs-unique="/api/unique">`

_Spec: [Uniqueness](../specs/vocabulary.md#uniqueness), [protocol](../specs/submission-protocol.md#uniqueness-sub-protocol)_

### `data-fs-when-valid`

Makes an element react to the validity of the whole form. `hide` hides the element while the form is valid, for example a "please finish" note. `show` is the inverse. `enable` enables the element only when the form is valid. Goes on any element.

`<p data-fs-when-valid="hide">Almost there — finish the highlighted questions.</p>`

_Spec: [When Valid](../specs/vocabulary.md#when-valid)_

## Field Types

The catalog for `data-fs-type`, in short form. The exact acceptance rules are in the spec's [Field Types](../specs/vocabulary.md#field-types) tables. Some types have a tidied form. Those types rewrite a valid answer into that form when the person leaves the field.

| Type                  | Accepts                                              | Tidied form           |
| --------------------- | ---------------------------------------------------- | --------------------- |
| `alpha`               | Letters only                                         |                       |
| `alphanum`            | Letters and digits                                   |                       |
| `identifier`          | Letters, digits, `_`, `-`                            |                       |
| `no-whitespace`       | All characters except whitespace                     |                       |
| `email`               | An address with a real domain (dot required)         |                       |
| `email-list`          | Addresses with commas or whitespace between them     |                       |
| `us-phone`            | US numbers in common punctuation                     | `(303) 555-1234`      |
| `international-phone` | 7–15 digits, common punctuation                      | `+442079460958`       |
| `zip`                 | ZIP or ZIP+4                                         | `80210` / `80210-1234`|
| `ssn`                 | Nine digits, with or without separators              | `123-45-6789`         |
| `us-dollar`           | Dollar amounts, with or without `$` and commas       | `1234.50`             |
| `duration`            | Minutes (`90`) or `H:MM` (`1:30`)                    | `1:30`                |
| `credit-card`         | Card numbers for the networks in the param           |                       |
| `cvv`                 | Three or four digits                                 |                       |
| `ip`, `ipv4`, `ipv6`  | Network addresses, both families or one family       |                       |

## Layout Classes

Presentation only. A server that validates a submission ignores them. The contract of the stylesheet is the spec's [Layout Classes](../specs/vocabulary.md#layout-classes) section.

| Class          | Where                              | Effect                                               |
| -------------- | ---------------------------------- | ---------------------------------------------------- |
| `fs-stacked`   | A row, a group `ul`, or the `form` | Stacked labels for the element and all fields in it  |
| `fs-inline`    | A row or a group `ul`              | Labels beside controls, cancels a stacked scope      |
| `fs-inline`    | With `fs-toggles`, in a row        | Legend in the label column, choices beside it        |
| `fs-cols`      | A field group `ul`                 | Two-column layout for the rows of the group          |
| `fs-col-start` | A row in an `fs-cols` group        | The second column starts here (default: midpoint)    |
| `fs-compound`  | A wrapper in a row                 | Controls side by side under one shared label         |
| `fs-toggles`   | A choice-group `fieldset`          | The styled checkbox and radio appearance             |
| `fs-buttons`   | With `fs-toggles`                  | Choices as toggle buttons                            |

`fs-stacked` and `fs-inline` cascade. The nearest declaration wins. Both control only the wide layout. A narrow form always stacks its labels.

## Events

Site code observes a form through bubbling `fs:` events: `fs:init`, `fs:field-valid`, `fs:field-invalid`, `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error`. Targets, payloads, and timing are in the spec's [Events](../specs/vocabulary.md#events) table. Extra submission fields, for example captcha and payment tokens, go through `addPreSubmitHook(form, fn)`. See the [guide's submission chapter](guide.md#10-submission).

## Theming

All knobs are in the spec's [Theming Knobs](../specs/vocabulary.md#theming-knobs) section: the custom properties, their defaults, and what each controls. The two responsive breakpoints, and the recipe to move them, are in [Breakpoints](../specs/vocabulary.md#breakpoints).
