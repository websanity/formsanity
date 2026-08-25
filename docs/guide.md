# The FormSanity Guide

This guide teaches you to write FormSanity forms. The [vocabulary spec](../specs/vocabulary.md) is the full definition. Where this guide and a spec disagree, the spec is correct.

The `demos/` pages show each area of the vocabulary in a live form. Browse them at [websanity.github.io/formsanity/demos](https://websanity.github.io/formsanity/demos/). Or start the dev server with `npm run serve` and open `http://localhost:8347/demos/`.

## 1. Your First Form

A FormSanity form is ordinary HTML that describes its own rules. You write the markup. The engine reads the markup and makes the form operate. You do not write wiring code. You do not attach listeners, register validators, or write a configuration object.

Load the stylesheet and the module one time per page. Then add the `data-fs-form` attribute to each form:

```html
<link rel="stylesheet" href="formsanity.css">
<script type="module">
	import { init } from './formsanity.js';
	init();
</script>

<form data-fs-form action="/api/join" method="post">
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

The engine reads a small set of structures. A `fieldset` with a `legend` is a **section**. A `ul` in a section is a **field group**. Each `li` is a **row**. A row holds a `label`, its control, and an optional `small` annotation. The label comes first in the row. That is the full convention. It uses no wrapper `div` elements and no special classes.

With this markup, the form above already does all of this:

- The submit button stays disabled until every answer is acceptable.
- An asterisk marks each required question until the person answers it.
- A wrong answer gets an error bubble under the field. The message matches the mistake. When the person corrects the answer, the bubble goes away.
- A status line above the submit button says if some answers are missing. After submission it shows the "sending", "thanks", or "something went wrong" message.
- On submit, the engine posts the answers to the `action` URL as JSON. Chapter 10 describes what the server receives and returns.

The engine also selects the correct time to show an error. Some answers are dead ends, for example a letter in a number field. The engine flags a dead end immediately. Other answers are not complete yet, for example an email address without its domain. There the engine waits until the person leaves the field. The form stays quiet while the person can still type a correct answer.

_Demo:_ [demos/required.html](https://websanity.github.io/formsanity/demos/required.html).

## 2. Form Layout

Layout is a separate vocabulary from validation, on purpose. Rules live in `data-fs-*` attributes. Layout lives in **classes**. A server that validates a submission reads the attributes and ignores the classes. Thus you can restyle a form without a change to its meaning.

By default, each row puts its label on the left and its control on the right. The labels align down the group. The stylesheet supplies these classes for other layouts:

| Class          | Where                              | Effect                                                                                                       |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `fs-stacked`   | A row, a group `ul`, or the `form` | Puts labels above their controls. Good for textareas, or for a full form when you want that look.            |
| `fs-inline`    | A row or a group `ul`              | Puts labels beside their controls. This is the default. Use it to cancel `fs-stacked` from an outer element. |
| `fs-cols`      | A field group `ul`                 | Puts the rows of the group into two columns.                                                                 |
| `fs-col-start` | A row in an `fs-cols` group        | Starts the second column at this row.                                                                        |
| `fs-compound`  | A wrapper in a row                 | Puts two or more controls side by side under one shared label.                                               |
| `fs-toggles`   | A choice-group `fieldset`          | Applies the styled checkbox and radio appearance.                                                            |
| `fs-buttons`   | With `fs-toggles`                  | Shows each choice as a toggle button.                                                                        |

`fs-stacked` and `fs-inline` cascade. The nearest declaration wins. A class on a row wins against its group. A class on a group wins against the form. To stack labels in the full form, put one `fs-stacked` on the `form`. A group or a row can cancel it with `fs-inline`. These classes control only the wide layout. A narrow form always stacks its labels. Thus a phone layout cannot get labels beside controls by accident.

An `fs-cols` group without `fs-col-start` splits at the midpoint. To select the split, put `fs-col-start` on a row. An `fs-stacked` row in a wide `fs-cols` group is one label-control pair wide. Thus two stacked rows sit side by side. A full `fs-cols` group marked `fs-stacked` pairs every row this way, in reading order.

Radio and checkbox sets have their own structure. A `fieldset` holds the set. Its `legend` is the question of the group. A `ul` in the `fieldset` holds the inputs, each wrapped in a label:

```html
<fieldset class="fs-toggles">
	<legend>Toppings</legend>
	<ul>
		<li><label><input type="checkbox" name="toppings" value="pepperoni"> Pepperoni</label></li>
		<li><label><input type="checkbox" name="toppings" value="mushrooms"> Mushrooms</label></li>
	</ul>
</fieldset>
```

Two or more controls can share one label, for example a first name and a last name. The shared label becomes a `span` with an `id`. Each control points at the `span` with `aria-labelledby`. A `div.fs-compound` wraps the controls. Each control keeps its own `name` and its own rules. The row shows one label and shows the worst state of its fields. See [Compound Fields](../specs/vocabulary.md#compound-fields) for the full pattern.

Sometimes this structure does not fit, for example a form fragment in a different layout. Then wrap the label and control in an element with `data-fs-field`. The engine uses that wrapper as the row. See [Freeform Rows](../specs/vocabulary.md#freeform-rows).

The layout is responsive without work from you. It responds to the width of the form, not the width of the viewport. Below `32rem`, labels move above their controls. Below `52rem`, an `fs-cols` group becomes one column. Thus a form in a narrow sidebar behaves correctly on a wide screen. Your site CSS can move the two breakpoints. The recipe is in the spec's [Breakpoints](../specs/vocabulary.md#breakpoints) section.

_Demo:_ [demos/layout.html](https://websanity.github.io/formsanity/demos/layout.html). Resize the window to see the columns and labels change.

## 3. Required Answers

Use HTML's own `required` attribute. FormSanity has a rule: when native HTML can state a constraint, use native HTML. Requiredness is the plainest case:

```html
<li>
	<label for="name">Name</label>
	<input id="name" name="name" type="text" required>
</li>
```

An unanswered required question gets an asterisk after its label. The status line of the form asks the person to finish the form. The question never gets an error bubble. FormSanity keeps two signals apart. The **asterisk** means "not answered yet". The **bubble** means "answered wrong". A question that the person did not reach is not a mistake. The asterisk marks what remains. When the person answers the question, the asterisk goes away.

Two attributes state requiredness across fields, where `required` alone cannot:

- `data-fs-group-required-any="phone"` on two or more fields means: the person must answer at least one of these fields. For example, a home phone or a mobile phone.
- `data-fs-group-required-together="card"` means: the person must answer all fields of the group, or none. For example, a card number, an expiry date, and a CVV.

The value is a group name that you invent. Every field with the same attribute and the same name belongs to the group.

Checkbox sets count selections. `data-fs-min-selected="2"` and `data-fs-max-selected="4"` limit how many boxes the person can check. They also apply to a `select multiple`. Put either attribute on any member of the set. Too few selections is only _unfinished_, because the person can check more boxes. Too many selections is an _error_, because the person must undo a selection. Thus only `max-selected` makes a bubble.

One trap: `required` on a checkbox applies to that one checkbox, not to the set. This is HTML's rule. To require at least one checked box, use `data-fs-min-selected="1"`. That attribute knows the set. A radio group is different: `required` on any member requires the group. This is also HTML's own rule.

_Demo:_ [demos/required.html](https://websanity.github.io/formsanity/demos/required.html).

## 4. Typed Values

HTML validates some formats natively. Use those types where they exist: `type="email"`, `type="url"`, `type="date"`, `type="time"`, and `type="number"`. They bring the correct mobile keyboard and the browser's own validation. All numeric fields use `type="number"`: `min="0"` for values of zero or more, `step="1"` for integers, and both together for counts.

For formats without an HTML type, use `data-fs-type`:

```html
<li>
	<label for="phone">Phone</label>
	<input id="phone" name="phone" type="tel" data-fs-type="us-phone" autocomplete="tel">
</li>
```

The catalog covers names and identifiers (`alpha`, `alphanum`, `identifier`, `no-whitespace`), contact details (`email`, `email-list`, `us-phone`, `international-phone`, `zip`), money and time (`us-dollar`, `duration`), payment (`credit-card`, `cvv`), and network addresses (`ip`, `ipv4`, `ipv6`), plus `ssn`. The full definitions, character by character, are in the spec's [Field Types](../specs/vocabulary.md#field-types) section.

There are two email types. `type="email"` is HTML's definition. It accepts `jans@websanity`, a bare host without a dot. `data-fs-type="email"` requires the dot. If the address must receive mail, use `data-fs-type="email"`.

Typed fields show FormSanity's **three verdicts** most clearly. Every answer is `valid`, `incomplete`, or `invalid`. The test between the last two: can more characters correct the answer? `jans@web` can still become an address, thus it is incomplete. `jans@web@x` can never become an address, thus it is invalid. The verdict controls the times from chapter 1. The engine flags an invalid answer immediately. For an incomplete answer, the engine waits until the person leaves the field.

Some types also **rewrite the committed answer**. Type `90` in a duration field and leave the field: the value becomes `1:30`. `123456789` in an SSN field becomes `123-45-6789`. `$1,234.5` becomes `1234.50`. Each type accepts every usual spelling of the value. Then the type rewrites the value into one canonical form. Thus the server always receives one spelling, and the person sees that the form understood them. The engine rewrites only valid answers. A wrong answer stays as typed, so the error message can refer to it.

A typed field with a known shape gets a matching `placeholder`, for example `#####` or `#####-####` for `zip`. A placeholder that you write wins.

Two types have an order and accept limits in their own format: `data-fs-min="2:00"` on a duration, or `data-fs-min="$5.00"` on a dollar amount. Native types keep native `min` and `max`. The `credit-card` type takes a parameter that names the permitted networks: `data-fs-type-param="Visa|MasterCard"`.

_Demo:_ [demos/types.html](https://websanity.github.io/formsanity/demos/types.html). Type slowly to see the verdicts change.

## 5. Limits

Length limits are native: `minlength` and `maxlength`. A control with `maxlength` also gets a live counter of remaining characters under it. No attribute is necessary. The counter comes with the constraint.

Value limits are native too: `min`, `max`, and `step` on numbers, dates, and times, as HTML defines them. Note: when `min` is set, `step` counts from `min`. Thus `min="5" step="2"` permits 5, 7, and 9, not the even numbers.

Password rules that count character classes get three attributes of their own, because `pattern` states them badly:

```html
<input id="password" name="password" type="password" autocomplete="new-password" minlength="10" data-fs-min-digits="1" data-fs-min-uppercase="1" required>
```

For a `datetime-local` field, `min` and `max` limit the full span. They cannot state "business hours on each day". `data-fs-min-time="09:00"` and `data-fs-max-time="17:00"` limit the time-of-day part separately. A reversed pair wraps around midnight. See [Daily Time Windows](../specs/vocabulary.md#daily-time-windows).

File uploads take two limits. Native `accept` filters by extension or media type. FormSanity enforces `accept`, because the browser alone permits a drag-and-drop to bypass it. `data-fs-max-file-size` limits the size, in human units:

```html
<li>
	<label for="attachment">Attachment</label>
	<input id="attachment" name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">
</li>
```

_Demo:_ [demos/limits.html](https://websanity.github.io/formsanity/demos/limits.html).

## 6. Field Comparisons

`data-fs-constraint` is the full comparison surface of the vocabulary. Use it for every rule that involves more than one value. Confirm fields, date ranges, and "must differ" rules all use this one attribute. The attribute holds a small expression:

```html
<input id="confirm" name="confirm" type="password" data-fs-constraint="confirm == password" data-fs-constraint-message="Passwords do not match.">

<input id="checkout" name="checkout" type="date" data-fs-constraint="checkout >= checkin" data-fs-constraint-message="Check-out cannot precede check-in.">
```

The expression language reads as it looks. A bare word names a field by its `name` and reads its current value. Text is single-quoted (`'Other'`). Numbers are bare (`3`). `==` and `!=` compare exactly. `<`, `<=`, `>`, and `>=` compare in the correct order for each type. Dates compare in time order, times as times of day, dollars and durations in their own order, and numbers numerically. Combine clauses with `&&` (and), `||` (or), and `!` (not). Use parentheses when the order is not clear. One special form, `valid(name)`, is true when the named field is answered and passes its own validation. Chapter 7 uses it again.

Put the constraint on the field that it judges, the field whose bubble must show. Write the rule so that the name of that field appears in it. Each field takes one constraint. For two conditions, join them with `&&`.

Constraints are patient. A constraint does not fire while a mentioned field is unanswered. It also does not fire while the answer in a mentioned field is wrong. Thus the engine never complains about a comparison with a question that the person did not reach. The error stays on the field that needs the correction. There is one exception. A confirm field flags immediately when it can no longer match. Type one wrong character into `confirm` and the mismatch shows, because no more typing can correct it. This is the dead-end rule from chapter 4, applied to `==`.

Always write `data-fs-constraint-message`. The engine cannot compute a readable sentence from an expression. Without a message, the bubble shows a generic line.

The full grammar, with precedence, quoting, and the empty-value rules, is in [Constraint Expressions](../specs/vocabulary.md#constraint-expressions) and [Expression Grammar](../specs/vocabulary.md#expression-grammar).

_Demo:_ [demos/comparisons.html](https://websanity.github.io/formsanity/demos/comparisons.html).

## 7. Relevance

FormSanity's word for conditional logic is **relevance**. It is one idea: a field is part of the conversation now, or it is not. `data-fs-relevant` holds an expression in the language of chapter 6. While the expression is false, the field drops out:

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

An irrelevant field is not only hidden. It is **unvalidated**: its `required` attribute and rules stop, so it cannot block the form. It is **unsubmitted**: its name never goes to the server. It is **disabled**: it leaves the tab order. Hidden is only the default presentation. `data-fs-irrelevant="disabled"` keeps the row visible but dimmed. If rows that vanish make the form feel unstable, use this mode.

Put `data-fs-relevant` on an element that is not a control, and it controls a **region**. The element and every field in it follow one expression. This is how a full card-details section appears only for `pay-method == 'card'`. A region without fields is conditional text:

```html
<ul data-fs-relevant="pay-method == 'card'">
	<li> … card number … </li>
	<li> … CVV … </li>
</ul>
<p data-fs-relevant="pay-method == 'invoice'">Nothing to fill in now — we will email an invoice after checkout.</p>
```

Nested conditions combine. A field in a region is relevant only while its own expression and the region's expression are both true.

`valid(name)` is useful here. `data-fs-relevant="valid(account-password)"` on a confirm field hides the confirmation until a well-formed password exists. The password must be answered and acceptable, not only non-empty.

Know three things before you write complex conditions:

- **A checkbox set reads as its checked values, joined with commas.** Thus `roles == 'Editor'` is true only while Editor is the only checked box. Check a second box and the value is `Editor,Reviewer`, which matches nothing. Test one checkbox with `ship == 'on'`. For multi-checkbox conditions, design the form so that one box drives the condition.
- **A choice set with two or more members does not vanish in hidden mode.** It has no single row to hide, thus it grays in place. To make it vanish, wrap it in a region.
- **Never write a condition on a field that can itself become irrelevant.** The client and the server then disagree about the value of that field. The spec forbids this construction. Instead, repeat clauses on fields that are always relevant.

_Demo:_ [demos/relevance.html](https://websanity.github.io/formsanity/demos/relevance.html).

## 8. Behaviors

Behaviors are conveniences that the engine performs in the browser. They shape the experience, never the validity. A server that validates a submission ignores all of them. These are the useful ones:

**Mirror and clear.** `data-fs-copy-to="target"` copies the answer of this control to another field while the person types. Same-as-billing addresses are its main use. Its opposite, `data-fs-clear-on-change="source"`, empties this control when the named source field changes. A confirmation means nothing after the password changes. A selected state is stale after the country changes. A stale dependent answer is worse than an empty one.

**Live totals.** Mark contributing controls with `data-fs-amount` and a destination with `data-fs-amount-total`. The engine keeps the sum current. A bare `data-fs-amount` reads the value of its own control, for example "donation: $___". With a value, it is a price that the control adds while checked or selected. On a quantity control, it is price times count. Show the total in an `<output>` and post it through a hidden input. Mark both as destinations:

```html
<li>
	<span>Total</span>
	<output id="total" data-fs-amount-total></output>
	<input name="total" type="hidden" data-fs-amount-total>
</li>
```

**Generated options.** `data-fs-year-options="0,5"` on a select generates this year through five years from now. `data-fs-month-options="0,11"` generates the twelve months from the current month. Your static placeholder option stays first.

**Passwords.** `data-fs-reveal` adds the show/hide toggle. Also declare `autocomplete="new-password"` or `current-password`, so password managers behave predictably.

**Caps.** `data-fs-prefix` and `data-fs-suffix` show a small cap attached to the box of the control, for example a `$`, a unit, or `@example.org`. File, date, and time inputs get a cap automatically: the "Choose file…" button, or the calendar or clock symbol that opens the picker. Caps are visual only. Meaning that matters belongs in the label or the annotation.

**Escape hatches.** `data-fs-label` names the field in its messages when the visible label does not read well in a sentence. Compound rows need this, because their shared label is a `span` that the naming chain cannot see. `data-fs-error-to` moves the bubble of a field to a container that you select. `data-fs-message-incomplete` and `data-fs-message-invalid` on the form replace the two standing status lines. `data-fs-no-gate` on the form keeps the submit button enabled. The engine still refuses a submission with errors and focuses the first problem. You only remove the disabled button.

One more behavior needs no attribute. Click a checked radio again to uncheck it. Click the only selection in a multi-select to clear it. There is one exception: a required field with an authored default. There blank is never a correct value, and this gesture is off.

The rest, with the exact copy-to semantics for radio and checkbox targets, is in the spec's [Behaviors](../specs/vocabulary.md#behaviors) section.

_Demo:_ [demos/operations.html](https://websanity.github.io/formsanity/demos/operations.html).

## 9. Themes

The stylesheet lives in `@layer formsanity`. Layered rules lose to unlayered rules. Thus every rule in your site's stylesheet wins against the library, without `!important` and without a specificity fight.

For common adjustments, you do not need a rule of your own. The form reads about two dozen custom properties: colors, spacing, borders, the error palette, and the toggle accent. Redefine them on the form or on any ancestor. This is the supported theming surface:

```css
.fs-form {
	--fs-font-family: "Jost", sans-serif;
	--fs-border-radius: 0;
	--fs-toggle-accent: hsl(160 60% 35%);
}
```

The full table of knobs, with defaults, is in [Theming Knobs](../specs/vocabulary.md#theming-knobs). The set is closed on purpose. For anything without a knob, write an ordinary site rule. That rule is unlayered, thus it wins.

Knobs cannot move the two responsive breakpoints from chapter 2, because container queries cannot read custom properties in their conditions. To move one, use a short two-rule recipe in site CSS. See [Breakpoints](../specs/vocabulary.md#breakpoints).

_Demo:_ [any demo page](https://websanity.github.io/formsanity/demos/) shows the default theme.

## 10. Submission

When every relevant field is valid, the gate opens. On submit, the engine posts every relevant answer to the `action` URL of the form. The format is JSON, or `multipart/form-data` when the form contains a file input. Checkbox and radio answers travel as arrays of the checked values. The engine does not send an irrelevant or disabled field. The value of a hidden input arrives byte-for-byte as the server rendered it. Thus CSRF tokens and routing keys are safe in the form.

The server answers with a small JSON envelope. The engine handles each outcome:

- **Accepted.** The status region shows success and the server's `message`. Or the browser goes to the server's `redirect`.
- **Invalid.** The per-field errors from the server land on the fields, with bubbles, as if the engine caught them locally. Form-level failures, for example a spam rejection or an expired token, appear as lines in the status region.
- **Error.** A failure occurred that an edit of the form cannot correct. The status region shows the failure.

Some payloads need data beyond the fields, for example a captcha token or a payment token. Site code injects that data through the pre-submit hook. The library never learns what the data means:

```js
import { addPreSubmitHook } from './formsanity.js';
addPreSubmitHook(form, async () => ({ token: await captcha.execute() }));
```

Site code can also observe without participation. The engine dispatches `fs:` events: `fs:init`, `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error`, and per-field verdict changes. All are listed under [Events](../specs/vocabulary.md#events).

Everything in this chapter has a precise wire-format definition in the [submission protocol spec](../specs/submission-protocol.md). Give that document to the person who builds the backend. Also tell them one thing: the client's validation is a courtesy to the person who types. The server must validate everything again.

_Demo:_ [demos/submission.html](https://websanity.github.io/formsanity/demos/submission.html).
