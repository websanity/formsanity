# The FormSanity Guide

This guide teaches you to write FormSanity forms. The [vocabulary spec](../specs/vocabulary.md) is the full definition; where this guide and a spec disagree, the spec is right.

The `demos/` pages run each area of the vocabulary against a live form: browse them at [websanity.github.io/formsanity/demos](https://websanity.github.io/formsanity/demos/), or start the dev server with `npm run serve` and open `http://localhost:8347/demos/`.

## 1. Your First Form

A FormSanity form is ordinary HTML that describes its own rules. You write markup; the engine reads it and brings it to life. There is no wiring code — no listeners to attach, no validators to register, no configuration object.

Load the stylesheet and the module once per page, then opt each form in with the `data-fs-form` attribute:

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

The structure is a small grammar the engine knows how to read: a `fieldset` with a `legend` is a **section**, a `ul` inside it is a **field group**, and each `li` is a **row** holding a `label`, its control, and an optional `small` annotation. The label comes first in the row. That's the whole convention — no wrapper `div`s, no special classes, just elements HTML already has.

For that markup, the form above already does all of this:

- The submit button stays disabled until every answer is acceptable.
- An asterisk marks each required question until it's answered.
- Wrong answers get an error bubble under the field, worded for the mistake — and the bubble disappears the moment the answer is fixed.
- A status line above the submit button says whether anything still needs attention, and later carries the "sending", "thanks", or "something went wrong" message.
- On submit, the answers post to the `action` URL as JSON (chapter 10 covers what the server sees and says back).

The engine is also polite about timing: a dead-end answer (a letter in a number field) is flagged the moment it's typed, but a half-finished answer (an email address without its domain yet) draws no complaint until you leave the field. Nothing yells at someone who is still typing.

_See it running:_ `demos/required.html`.

## 2. Laying Out the Form

Layout is a separate vocabulary from validation, on purpose: rules live in `data-fs-*` attributes, layout lives in **classes**. A server validating a submission reads the attributes and ignores the classes entirely, so you can restyle a form without touching its meaning.

By default, each row puts its label on the left and its control on the right, and labels line up down the group. The shipped stylesheet gives you a handful of classes to go beyond that:

| Class          | Where                                    | What it does                                                           |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `fs-stacked`   | A row, a group `ul`, or the `form`       | Stacks labels above their controls — right for textareas, or a whole form when that's the look you want |
| `fs-inline`    | A row or a group `ul`                    | Labels beside their controls — the default, restated to opt back out inside a stacked scope |
| `fs-cols`      | A field group `ul`                       | Lays the group's rows into two columns                                 |
| `fs-col-start` | A row inside an `fs-cols` group          | The second column starts at this row                                   |
| `fs-compound`  | A wrapper inside a row                   | Several controls side by side under one shared label                   |
| `fs-toggles`   | A choice-group `fieldset`                | The styled checkbox and radio treatment                                |
| `fs-buttons`   | With `fs-toggles`                        | Renders each choice as a toggle button                                 |

`fs-stacked` and `fs-inline` cascade, and the nearest declaration wins: a row's class beats its group's, a group's beats the form's. Prefer stacked labels throughout? One `fs-stacked` on the `form` says so, and any group or row opts back out with `fs-inline`. Both govern only the wide layout — a narrow form stacks its labels regardless, so there's no way to accidentally force labels beside controls on a phone.

An `fs-cols` group without an `fs-col-start` splits itself at the midpoint; writing `fs-col-start` on a row picks the split yourself. An `fs-stacked` row inside a wide `fs-cols` group is one label/control pair wide, so two stacked rows sit side by side — and a whole `fs-cols` group marked `fs-stacked` pairs every row that way, two-up in reading order.

Radio and checkbox sets have their own grammar — a `fieldset` whose `legend` is the group's question, holding a `ul` of label-wrapped inputs:

```html
<fieldset class="fs-toggles">
	<legend>Toppings</legend>
	<ul>
		<li><label><input type="checkbox" name="toppings" value="pepperoni"> Pepperoni</label></li>
		<li><label><input type="checkbox" name="toppings" value="mushrooms"> Mushrooms</label></li>
	</ul>
</fieldset>
```

Several controls can share one label — first and last name, say. The shared label becomes a `span` with an `id`, each control points at it with `aria-labelledby`, and a `div.fs-compound` wraps the controls. Each control keeps its own `name` and its own rules; the row shows one label and reflects the worst state among its fields. See [Compound Fields](../specs/vocabulary.md#compound-fields) for the full pattern.

When the grammar doesn't fit — a form fragment inside some other layout — wrap the label and control in any element carrying `data-fs-field`, and the engine treats that wrapper as the row. See [Freeform Rows](../specs/vocabulary.md#freeform-rows).

The layout is responsive without any work on your part, and it responds to the form's own width, not the viewport: below `32rem` labels move above their controls, and below `52rem` an `fs-cols` group collapses to a single column. A form in a narrow sidebar behaves correctly on a wide screen. Both breakpoints can be moved in site CSS — the recipe is in the spec's [Breakpoints](../specs/vocabulary.md#breakpoints) section.

_See it running:_ `demos/required.html` — resize the window and watch the columns and labels reflow.

## 3. Requiring Answers

Use HTML's own `required` attribute. FormSanity's rule is that native HTML wins wherever it can express the rule, and requiredness is the plainest case:

```html
<li>
	<label for="name">Name</label>
	<input id="name" name="name" type="text" required>
</li>
```

An unanswered required question gets the asterisk after its label, and the form's status line reads "please finish the form" territory. What it never gets is an error bubble. FormSanity keeps two vocabularies strictly apart: the **asterisk** means "not answered yet", the **bubble** means "answered wrong". A question you haven't reached is not a mistake, so the form doesn't scold — the asterisk quietly marks what remains, and disappears the moment the question is answered.

Two attributes handle requiredness that spans fields, where "required" alone can't say what you mean:

- `data-fs-group-required-any="phone"` on several fields means _at least one of these must be answered_ — home phone or mobile, either will do.
- `data-fs-group-required-together="card"` means _all or none_ — a card number, expiry, and CVV where filling in one commits you to the rest, but leaving the whole set blank is fine.

The value is a group name you invent; every field carrying the same attribute with the same name belongs to the group.

Checkbox sets count rather than require: `data-fs-min-selected="2"` and `data-fs-max-selected="4"` bound how many boxes may be checked, and they also work on a `select multiple`. Either attribute can sit on any member of the set. Too few selections is merely _unfinished_ (you can still check more), while too many is an _error_ (you have to undo something) — so only `max-selected` produces a bubble.

One trap worth knowing: `required` on a checkbox binds to that one checkbox, not to the set — HTML's rule. To require "at least one box checked", use `data-fs-min-selected="1"`, which understands the set. (A radio group is fine: `required` on any member requires the group, again HTML's own rule.)

_See it running:_ `demos/required.html`.

## 4. Typed Values

HTML validates a few formats natively, and you should use those types where they exist — `type="email"`, `type="url"`, `type="date"`, `type="time"`, `type="number"` — because they bring the right mobile keyboard and the browser's own machinery along. The numeric variants are all spellings of `type="number"`: `min="0"` for non-negative, `step="1"` for integers, both for counts.

For the formats HTML has no type for, `data-fs-type` picks up where the platform stops:

```html
<li>
	<label for="phone">Phone</label>
	<input id="phone" name="phone" type="tel" data-fs-type="us-phone" autocomplete="tel">
</li>
```

The catalog covers names and identifiers (`alpha`, `alphanum`, `identifier`, `no-whitespace`), contact details (`email`, `email-list`, `us-phone`, `international-phone`, `zip`), money and time (`us-dollar`, `duration`), payment (`credit-card`, `cvv`), and network addresses (`ip`, `ipv4`, `ipv6`), plus `ssn`. The full definitions — exactly what each accepts, character by character — are in the spec's [Field Types](../specs/vocabulary.md#field-types) section.

(Yes, there are two emails. `type="email"` is HTML's definition, which accepts `jans@websanity` — a bare host, no dot. `data-fs-type="email"` insists on the dot, which is what you want when the address must actually receive mail.)

Typed fields are the clearest place to see FormSanity's **three verdicts**. Every answer is `valid`, `incomplete`, or `invalid`, and the test between the last two is: _could typing more characters fix it?_ `jans@web` could still become an address — incomplete. `jans@web@x` never can — invalid. The verdict drives the timing you met in chapter 1: dead ends are flagged immediately, works-in-progress wait until you leave the field.

Several types also **tidy the committed answer**. Type `90` into a duration field and tab away: it becomes `1:30`. `123456789` in an SSN field becomes `123-45-6789`; `$1,234.5` becomes `1234.50`. The type accepts every way a person plausibly writes the value, then rewrites it into one canonical form — so the server always receives one spelling, and the person sees the form understood them. Only valid answers are rewritten; a wrong answer stays exactly as typed so the error message can talk about it.

Typed fields with a shape get a matching `placeholder` for free (`#####` or `#####-####` for `zip`), and any placeholder you write yourself wins.

Two types define an ordering, and can be bounded in their own format: `data-fs-min="2:00"` on a duration, `data-fs-min="$5.00"` on a dollar amount. (Native `min`/`max` keep that job for native types.) And `credit-card` takes a parameter naming the accepted networks: `data-fs-type-param="Visa|MasterCard"`.

_See it running:_ `demos/types.html` — type slowly and watch the verdicts change.

## 5. Limits

Length is native: `minlength` and `maxlength`. A control with `maxlength` also gets a live characters-remaining counter beneath it, no attribute needed — the counter simply rides along with the constraint.

Value bounds are native too: `min`, `max`, and `step` on numbers, dates, and times, exactly as HTML defines them. Note that `step` counts from `min` when one is set — `min="5" step="2"` allows 5, 7, 9, not the even numbers.

Password rules that count character classes get three attributes of their own, since `pattern` states them badly:

```html
<input id="password" name="password" type="password" autocomplete="new-password" minlength="10" data-fs-min-digits="1" data-fs-min-uppercase="1" required>
```

For a `datetime-local` field, `min` and `max` bound the overall span but can't say "business hours on any of those days". `data-fs-min-time="09:00"` and `data-fs-max-time="17:00"` bound the time-of-day component separately, and a reversed pair wraps midnight — see [Daily Time Windows](../specs/vocabulary.md#daily-time-windows).

File uploads take two limits. Native `accept` filters by extension or media type — and FormSanity actually enforces it, because the browser alone treats it as advice a drag-and-drop can bypass. `data-fs-max-file-size` caps the size, in human units:

```html
<li>
	<label for="attachment">Attachment</label>
	<input id="attachment" name="attachment" type="file" accept=".pdf" data-fs-max-file-size="2MB">
</li>
```

_See it running:_ `demos/limits.html`.

## 6. Comparing Fields

`data-fs-constraint` is the vocabulary's whole comparison surface: any rule that involves more than one value. Confirm fields, date ranges, "must differ from" — they are all the same attribute holding a small expression:

```html
<input id="confirm" name="confirm" type="password" data-fs-constraint="confirm == password" data-fs-constraint-message="Passwords do not match.">

<input id="checkout" name="checkout" type="date" data-fs-constraint="checkout >= checkin" data-fs-constraint-message="Check-out cannot precede check-in.">
```

The expression language reads like it looks. A bare word names a field by its `name` and reads its current value. Text is single-quoted (`'Other'`), numbers are bare (`3`). `==` and `!=` compare exactly; `<`, `<=`, `>`, `>=` compare sensibly for what's being compared — dates chronologically, times as times of day, dollars and durations in their own order, numbers numerically. Combine clauses with `&&` (and), `||` (or), and `!` (not), with parentheses when in doubt. One special form, `valid(name)`, is true when the named field is answered _and passes its own validation_ — you'll meet it again in chapter 7.

Put the constraint on the field it judges — the one whose bubble should show — and write the rule so that field's own name appears in it. One constraint per field; need two conditions, join them with `&&`.

Constraints are patient. A constraint doesn't fire while the fields it mentions are unanswered, or while a mentioned field's own answer is wrong — the person filling in a form top to bottom is never scolded about a comparison against a question they haven't reached, and an error stays on the field that actually needs fixing. The one deliberate exception to patience: a confirm field flags _immediately_ once it can no longer match — type one wrong character into `confirm` and the mismatch shows, because no continuation can fix it. That's the same dead-end reasoning as chapter 4, applied to `==`.

Always write `data-fs-constraint-message`. No readable sentence can be computed from an expression, so without one the bubble falls back to a generic line.

The full grammar — precedence, quoting, the empty-value rules — is in [Constraint Expressions](../specs/vocabulary.md#constraint-expressions) and [Expression Grammar](../specs/vocabulary.md#expression-grammar).

_See it running:_ `demos/comparisons.html`.

## 7. Showing and Hiding

FormSanity's word for conditional logic is **relevance**, and it is one idea: a field is either part of the conversation right now, or it isn't. `data-fs-relevant` holds an expression — the same language as chapter 6 — and while it's false, the field drops out entirely:

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

An irrelevant field isn't just hidden. It is **unvalidated** (its `required` and rules go quiet, so it can't hold the form hostage), **unsubmitted** (its name never reaches the server), and **disabled** (it leaves the tab order). Hiding is only the default presentation: `data-fs-irrelevant="disabled"` keeps the row visible but dimmed, for when vanishing rows would make the form feel jumpy.

Put `data-fs-relevant` on any element that isn't a control and it governs a **region**: the element and every field inside it follow one expression. That's how a whole card-details section appears only for `pay-method == 'card'` — and a region with no fields in it is simply conditional text:

```html
<ul data-fs-relevant="pay-method == 'card'">
	<li> … card number … </li>
	<li> … CVV … </li>
</ul>
<p data-fs-relevant="pay-method == 'invoice'">Nothing to fill in now — we will email an invoice after checkout.</p>
```

Nested conditions multiply: a field inside a region is relevant only while its own expression _and_ the region's are both true.

`valid(name)` earns its keep here. `data-fs-relevant="valid(account-password)"` on a confirm field keeps the confirmation out of the conversation until there is a well-formed password to confirm — answered and acceptable, not merely non-empty.

Three things to know before you get creative:

- **A checkbox set reads as its checked values joined with commas.** So `roles == 'Editor'` is true only while _exactly_ Editor is checked — check a second box and the value is `Editor,Reviewer`, which equals nothing. Test a lone checkbox with `ship == 'on'`; for multi-checkbox conditions, design so one box drives the condition.
- **A multi-member choice set doesn't vanish in hidden mode** — it has no single row to hide, so it grays in place instead. Want it gone? Wrap it in a region.
- **Never write a condition against a field that can itself become irrelevant.** The client and a validating server genuinely disagree about what such a field's value is, so the spec outlaws the construction. Chain conditions by repeating clauses against always-relevant fields instead.

_See it running:_ `demos/relevance.html`.

## 8. Behaviors

Behaviors are conveniences the engine performs in the browser — they shape the experience, never the validity, and a validating server ignores them all. A tour of the useful ones:

**Mirroring and clearing.** `data-fs-copy-to="target"` mirrors this control's answer onto another field as it's typed — same-as-billing addresses are its home turf. Its complement `data-fs-clear-on-change="source"` empties this control whenever a named source field changes: a confirmation means nothing once the password changes, a chosen state is stale once the country changes. A stale dependent answer is worse than an empty one.

**Running totals.** Mark contributing controls `data-fs-amount` and a destination `data-fs-amount-total`, and the engine keeps the sum live. A bare `data-fs-amount` reads the control's own value ("donation: $___"); with a value it's a price the control charges while checked or selected — and on a quantity control, price times count. Show the total in an `<output>` and post it through a hidden input, both marked as destinations:

```html
<li>
	<span>Total</span>
	<output id="total" data-fs-amount-total></output>
	<input name="total" type="hidden" data-fs-amount-total>
</li>
```

**Generated options.** `data-fs-year-options="0,5"` on a select generates this year through five years out; `data-fs-month-options="0,11"` generates a rolling twelve months. Your static placeholder option stays first.

**Passwords.** `data-fs-reveal` adds the show/hide eye toggle. Declare `autocomplete="new-password"` or `current-password` alongside, so password managers behave predictably.

**Caps.** `data-fs-prefix` and `data-fs-suffix` render a small bookend fused to the control's box — a `$`, a unit, an `@example.org`. File, date, and time inputs get a cap automatically (the "Choose file…" button, the calendar or clock glyph that opens the picker). Caps are purely visual; meaning that matters belongs in the label or annotation.

**Escape hatches.** `data-fs-label` names the field in its messages when the visible label wouldn't read well in a sentence (compound rows need this — their shared label is a `span` the naming chain can't see). `data-fs-error-to` moves a field's bubble to a container you choose. `data-fs-message-incomplete` and `data-fs-message-invalid` on the form reword the two standing status lines. And `data-fs-no-gate` on the form keeps the submit button enabled — submission with errors is still refused and focuses the first problem; you're opting out of the disabled button, nothing more.

Also in this family, no attribute needed: a checked radio can be clicked again to uncheck it, and the sole selection in a multi-select can be clicked to clear it — unless the field is required with an authored default, in which case blank is never legitimate and the gesture is off.

The rest, including exact copy-to semantics for radio and checkbox targets, is in the spec's [Behaviors](../specs/vocabulary.md#behaviors) section.

_See it running:_ `demos/operations.html`.

## 9. Theming

The shipped stylesheet lives in `@layer formsanity`, and layered rules lose to unlayered ones — so any rule in your site's stylesheet outranks the library without `!important` and without a specificity fight. The library is designed to be overridden.

For the common adjustments you won't even need a rule of your own: the form reads two dozen custom properties — colors, spacing, borders, the error palette, the toggle accent — and redefining them on the form or any ancestor is the supported theming surface:

```css
.fs-form {
	--fs-font-family: "Jost", sans-serif;
	--fs-border-radius: 0;
	--fs-toggle-accent: hsl(160 60% 35%);
}
```

The full knob table, with defaults, is in [Theming Knobs](../specs/vocabulary.md#theming-knobs). The set is closed on purpose: anything without a knob is restyled with an ordinary site rule, which — being unlayered — simply wins.

The two responsive breakpoints from chapter 2 are the one thing knobs can't move, because container queries can't read custom properties in their conditions. Moving one is a short, two-rule recipe in site CSS, spelled out in [Breakpoints](../specs/vocabulary.md#breakpoints).

_See it running:_ any demo page — the shipped look is the default theme.

## 10. Submitting

When every relevant field is valid, the gate opens. On submit, the engine posts every relevant answer to the form's `action` URL — as JSON, or as `multipart/form-data` when the form contains a file input. Checkbox and radio answers travel as arrays of the checked values; an irrelevant or disabled field isn't sent at all; a hidden input's value arrives byte-for-byte as the server rendered it, which is what makes CSRF tokens and routing keys safe to tuck into the form.

The server answers with a small JSON envelope, and the engine handles each outcome:

- **Accepted** — the status region marks success and shows the server's `message`, or the browser navigates to the server's `redirect`.
- **Invalid** — the server's per-field errors land on the actual fields, bubbles and all, exactly as if the engine had caught them locally; form-level failures (a spam rejection, an expired token) appear as lines in the status region.
- **Error** — something failed that editing the form can't fix; the status region shows the failure.

Anything the payload needs beyond the fields — a captcha token, a payment token — is injected by site code through the pre-submit hook, and the library never learns what it means:

```js
import { addPreSubmitHook } from './formsanity.js';
addPreSubmitHook(form, async () => ({ token: await captcha.execute() }));
```

For site code that wants to watch rather than participate, the engine dispatches `fs:` events — `fs:init`, `fs:submit`, `fs:accepted`, `fs:rejected`, `fs:error`, and per-field verdict changes — all listed under [Events](../specs/vocabulary.md#events).

Everything in this chapter has a precise wire-format definition in the [submission protocol spec](../specs/submission-protocol.md) — that's the document to hand to whoever builds the backend, along with one sentence worth repeating to them: the client's validation is a courtesy to the person typing, and the server must re-validate everything.

_See it running:_ `demos/submission.html`.
