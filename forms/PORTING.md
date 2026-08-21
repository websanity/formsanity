# Porting a v1 Form to FormSanity v2

Four real forms from `formsanity-client/public/mock/` translated into v2 markup, and the rules that translation followed. The mechanical substitutions are a lookup table; everything after it is a judgment call, recorded here because the same call will come up again when the live v1 sites are migrated. This file is the seed of that migration playbook.

The normative target is `specs/vocabulary.md`. Where this document and the spec disagree, the spec wins and this document is wrong.

| Ported file                 | v1 source                                    | What it stresses                                                     |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `pfems-join.html`           | `mock/pfems-join.html`                       | Conditional membership join, password composition, amounts, payment  |
| `meteoritical-donate.html`  | `mock/meteoritical-donate-public.html`       | Amounts, an at-least-one group, three relevance conditions, payment  |
| `pfems-profile.html`        | `mock/pfems-profile.html`                    | Profile edit, file fields, counters, reveal, a plain choice group    |
| `pfems-aux-personnel.html`  | `mock/pfems-aux-personnel.html`              | File upload gated by relevance, choice-group-driven conditions       |

## Mechanical Substitutions

These need no thought. Read the left column, write the right one.

| v1                                                          | v2                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `class="formsanity"` on the `form`                          | `data-fs-form`                                                      |
| `data-required`                                             | `required`                                                          |
| `data-min-length` / `data-max-length`                       | `minlength` / `maxlength`                                           |
| `data-min-value` / `data-max-value`                         | `min` / `max` — numeric and date controls only, see below           |
| `data-pattern`                                              | `pattern`                                                           |
| `data-file-extension`                                       | `accept`                                                            |
| `data-type="email"`, `"us-phone"`, `"zip"`, `"us-dollar"`   | `data-fs-type` with the same name                                   |
| `data-type="password"`                                      | `data-fs-reveal` on an `input[type="password"]`                     |
| `data-type="time"`                                          | `type="time"` — the wire value normalizes to 24-hour `HH:MM`        |
| `data-min-length-uppercase` / `-lowercase` / `-digit`       | `data-fs-min-uppercase` / `-lowercase` / `-digits`                  |
| `data-required-at-least-one` / `-all-or-none`               | `data-fs-group-at-least-one` / `data-fs-group-all-or-none`          |
| `data-equal-to-field` and kin                               | `data-fs-equals-field` and kin                                      |
| `data-display="expr"`                                       | `data-fs-relevant="expr"`                                           |
| `data-enable="expr"`                                        | `data-fs-relevant="expr"` plus `data-fs-irrelevant="disabled"`      |
| `data-amount` / `data-amount-total`                         | `data-fs-amount` / `data-fs-amount-total` — but read the note below |
| `data-month-offset` / `data-year-offset`                    | `data-fs-month-options` / `data-fs-year-options`                    |
| `data-copy-value-to`                                        | `data-fs-copy-to`                                                   |
| `data-ignore-all-valid`                                     | `data-fs-no-gate` on the `form`                                     |
| `data-all-are-valid="enable"` on the submit button          | Delete it. Gating is the engine's default.                          |
| `data-left_label_breakpoint`, `data-multi_column_breakpoint`| Delete them. The stylesheet's container queries do this.            |
| `data-prefix`, `data-suffix`, `data-marker`, `data-label`   | Delete them. The engine writes its own error DOM.                   |
| `div.formsanity.alert` (processing, success, error)         | Delete all three. The engine renders `div.fs-status`.               |
| `p.missing-fields`, `p.invalid-fields`                      | Delete both. The status region carries the two standing lines.      |

## Structural Rewrites

The v1 grammar and the v2 grammar are close cousins, and four differences account for nearly every line that changes.

**The wrapper `div` inside each row goes away.** v1 wrapped every control in a bare `div` so its layout engine had something to size. v2 places the row's parts with grid areas, so the `li` holds the label, the control, and the optional `small` directly.

**`class="field-group"` on the `ul` goes away.** In v2 a `ul` inside a section _is_ the field group. `cols`, `col-break`, `block`, `compound`, `toggle-list`, and `buttons` all survive with their v1 names and meanings.

**Compound rows lose a level and gain names.** v1 nested `div.compound > div > input`, with the shared `label` carrying an `id`. v2 uses a `span` with the `id`, a `div.compound` holding the controls directly, `aria-labelledby` on each, and — this part is new — a `data-fs-label` on each, because a `span` is not a `label` and the message-naming chain would otherwise fall through to the raw field `name`.

**Placeholder options become real empty options.** `<option label="choose…"></option>` becomes `<option value="">choose…</option>`. Both produce an empty value; the second is what an author reading the markup expects to see.

The file-field decoration goes too: v1's `<label class="file" data-suffix="Choose file…">` wrapper around the input was there to style the native control, and v2's stylesheet styles the input itself.

## Judgment Calls, Form by Form

What follows is everything in these four ports that a lookup table could not decide — the places where the v1 markup was ambiguous, wrong, or said something v2 says differently, and what was chosen instead.

### pfems-join.html

The v1 mock's payment section carried `data-display="member_type != 'Unpaid'"`, but **the mock never defined a `member_type` field** — the attribute was copied from its sibling `pfems-renew.html` and left dangling, which made the condition permanently true and the section permanently visible. The v2 port restores the `member_type` radio group from `pfems-renew.html` so the conditional is real and testable. Porting a live form, check every relevance expression against the fields that actually exist; v1 failed a dangling reference open, and v2 does the same, so nothing complains.

**Section relevance had to be repeated per control.** v1's `data-display` sat on the `fieldset` and hid the section whole. v2 relevance is field-scoped: `data-fs-relevant` describes a field, and the engine hides that field's row. One v1 attribute became five identical ones, one per control in the payment section. See _Gaps_ below for the CSS that finishes the job.

**v1's `data-amount="80"` on a radio has no direct v2 spelling.** In v1 the amount lived in the attribute's value, so an option could carry a price its own `value` did not mention. `data-fs-amount` takes no value and reads the control's own, so either the option's value becomes the price — losing the tier name from the payload — or the price moves to a control of its own. This port took the second road: `member_type` stays semantic (`Standard` / `Unpaid`) and a readonly `dues` field inside the payment section carries the price and the `data-fs-amount` mark.

**Stripe became four fields and a hook.** v1's `data-type="stripe-credit-card"` mounted a Stripe Element on a single, nameless input. v2 prunes the attribute: the card controls are ordinary inputs validated by `data-fs-type="credit-card"` and `data-fs-type="cvv"`, and the token rides a pre-submit hook that the page registers itself. The expiry selects are new — v1 had none, because the Stripe Element drew its own — and they demonstrate `data-fs-month-options` and `data-fs-year-options`.

**Two v1 markup bugs were fixed rather than reproduced.** The Mailing Address group nested its `li` elements inside one another, and the state list gave District of Columbia `value="DE"`, colliding with Delaware.

**A `col-break` was added at Team.** v1's `cols` split a group at its midpoint and filled column-major; v2 flows row-major and splits where an author says to. Every ported `cols` group that had more than a couple of rows got an explicit `col-break` at the row that used to start the second column.

### meteoritical-donate.html

**`data-type="us-dollar"` and `data-min-value="5"` cannot combine in v2.** Native `min` constrains numeric and date controls, and a `us-dollar` field is `type="text"`. The six fund fields became `type="number" min="5" step="0.01"`, which is the honest v2 spelling: a real minimum, a numeric keyboard on mobile, and a `ValidityState` the server can re-derive. The cost is the `$` and comma tolerance the `us-dollar` format gave typists. The readonly `amount_total` display keeps `data-fs-type="us-dollar"`, since nobody types into it.

**The acknowledgement group declares `data-fs-irrelevant="disabled"` deliberately.** A choice group of two or more members has no row, so there is no box to hide and `hidden` mode would silently present as `disabled` anyway. The spec says to say so out loud, and the port does.

**Relevance on a `ul` and on a `.block` became relevance on controls.** v1 put `data-display="(tribute == 'yes')"` on the tribute group's `ul` and again on the comments `div.block`. In v2 each of the three controls carries the expression, and each hides its own row.

**`col-break` at Jessberger Fund and at Email** reproduces v1's midpoint split for the two `cols` groups, as above.

**The `$` prefix became a placeholder.** v1 drew a persistent dollar sign beside each fund box with `data-prefix="$"`, an engine-written decoration v2 prunes. A `placeholder` is the closest honest replacement; a form that needs the sign to stay visible should draw it in site CSS.

### pfems-profile.html

**The optional password keeps being optional.** v1's `data-type="password"` meant only "give this field a show/hide toggle"; it did not make the field required. The port carries `data-fs-reveal` and no `required`, and the annotation explaining that an empty password leaves the current one alone is preserved verbatim.

**`maxlength` buys the counter for free.** v1 needed its dynamic-content module to render a characters-remaining line under the three 500-character textareas. In v2 any `maxlength` control gets one, with no opt-in.

**The two file fields gained limits v1 never had.** `accept` and `data-fs-max-file-size` were added to the profile photo (2MB, images) and the AEMA certificate (5MB, PDF). v1 constrained neither, which was a defect rather than a decision — the vocabulary has the attributes, and an unconstrained upload field on a public form is an invitation.

### pfems-aux-personnel.html

This is the file-upload form, selected from the twelve mock forms carrying a `type="file"` control by counting conditional attributes.

| Candidate                       | `data-display` | `data-enable` | Conditional total | Controls |
| ------------------------------- | -------------- | ------------- | ----------------- | -------- |
| `pfems-aux-personnel.html`      | 5              | 2             | **7**             | 20       |
| `meteoritical-profile.html`     | 5              | 0             | 5                 | 26       |
| `rga-join.html`                 | 4              | 0             | 4                 | 19       |
| `ccomp-join.html`               | 3              | 0             | 3                 | 24       |
| `ccomp-profile.html`            | 3              | 0             | 3                 | 16       |
| `ccomp-service-request.html`    | 2              | 0             | 2                 | 10       |
| Six others                      | 0              | 0             | 0                 | 20–44    |

**v1's `data-required` on every checkbox of a set means "at least one".** All ten `facility_roles` checkboxes carried it. v2's `required` is native and binds to the single checkbox that carries it, so the set uses `data-fs-min-selected="1"` on its first member instead — the set-aware rule the spec points authors at for exactly this case.

**One v1 capability did not survive.** The two clubhouse-manager checkboxes disabled each other with `data-enable` on the members themselves. v2 relevance is field-scoped, and a rule attribute on any member of a choice group governs the whole field, so there is no way to spell "disable this one box while that one is checked". Recasting the pair as two one-checkbox fields referencing each other would work mechanically but violates the vocabulary's rule that a rule must not reference a field that can itself become irrelevant, which makes the behavior undefined. The mutual exclusion was therefore **dropped**, and both roles remain ordinary members of the set.

**Every relevance expression on this form changed meaning, not just markup.** All seven are driven by `facility_roles`, a checkbox set, and v1 and v2 compare a checkbox set by different rules — see the membership gap below. This is the more consequential of the two losses on this form: the `data-enable` pair is a feature that is simply gone and visibly so, while the comparison change is silent and only shows itself once a second box is checked.

**A file-size cap was added.** `data-fs-max-file-size="2MB"` and `accept` on the photo field, for the same reason as the profile form: v1 capped nothing.

**A checkbox value was normalized.** The first role's value read `Coach/Coach System Setup - Home` where its three siblings read `Coach-to-Coach…` / `Coach-to-Player…`. A live migration must not do this silently — a stored answer would stop matching — but in a mock fixture the odd one out is a typo, and consistency is worth more than reproducing it.

**Five `data-display` attributes became seven `data-fs-relevant` attributes.** Email, company, and photo took one each. The phone and other-phone rows account for the other four: each is a compound row whose number and type are two separate fields sharing one label, so each control needs its own copy of the expression.

**`cols` was dropped from the roles group.** v1 laid its ten checkboxes into two columns with `<ul class="cols">`. In v2 `cols` lays out label/control column pairs and applies to a field group, not to a `toggle-list`, whose `ul` is a flex column (or a wrapping row, with `buttons`). The class would have been inert markup, so it is gone rather than shipped.

## Gaps Found

Five places where a v1 form said something v2 has no single way to say. Each is a real finding from this port, not a hypothetical. The first is the one to read before migrating anything.

**A checkbox set compares as one joined string, not by membership.** This is a silent change of meaning, and the only item here that can make a ported form behave differently without looking any different.

In v1, an expression naming a checkbox set asked about membership: `facility_roles == 'Trucking Contact'` was true when that value was among the checked boxes, and `!=` was its negation. In v2, the field reads as **its checked values joined with commas in document order**, and `==` and `!=` compare that whole string against the operand. The two rules agree only while exactly one box is checked. Check a second one and every comparison against a single value flips:

| Checked                                          | v1 `== 'Visiting Clubhouse Manager'` | v2 same expression |
| ------------------------------------------------ | ------------------------------------ | ------------------ |
| `Visiting Clubhouse Manager`                     | true                                 | true               |
| `Trucking Contact`, `Visiting Clubhouse Manager` | true                                 | **false**          |
| `Trucking Contact`                               | false                                | false              |

`pfems-aux-personnel.html` is where this bites: all seven of its relevance expressions are driven by one checkbox set. Check Trucking Contact and Visiting Clubhouse Manager together and v1 hides the email and phone rows and shows the company and photo rows; v2 does the exact opposite. The port keeps the v1 expressions verbatim and accepts the v2 reading, and `test/e2e/forms.spec.js` pins that reading with a two-role case so the divergence is deliberate rather than discovered later.

Radio groups and `select` fields are unaffected: only one value can ever be checked, so the two rules coincide. Only a genuinely multi-select field is at risk, and the `data-fs-group-*` rules and `data-fs-min-selected` are not involved — this is about expressions alone.

The expression grammar has no membership operator, so there is no v2 spelling for what v1 meant. Migrating a live form driven by a checkbox set, take one of these:

- Make the driving field single-select — a radio group or a `select` — where the question really only ever had one answer. The two semantics then agree and nothing else changes.
- Restate the condition against a companion single-value field, which is what the vocabulary's advice to write conditions against unconditionally simple fields amounts to here.
- Enumerate the joined values the condition should match. This works and is brittle: the string depends on document order and on every other box in the set.

A membership operator — `contains`, or a set-aware reading of `==` when the named field is a choice group — is the clearest addition this port argues for.

**There is no section-level relevance.** `data-fs-relevant` describes a field. Repeating it across a section's controls hides every row but leaves the section's `legend` and prose behind, which reads as an empty heading. The recipe, in `forms/forms.css`, is site CSS rather than a library feature:

```css
form[data-fs-form] fieldset:has(:is(li, .block, [data-fs-field])[hidden]):not(:has(:is(li, .block, [data-fs-field]):not([hidden]))) {
	display: none;
}
```

A section that holds at least one row and has no unhidden row left hides itself. The row test must reach any depth and cover all three row kinds, or a section whose rows sit beside a nested choice group — which has no row, and so never goes `[hidden]` — will wrongly hide itself along with the group. That mistake was made and caught here; the rule above is the corrected one.

**There is no per-member relevance inside a choice group.** Described under `pfems-aux-personnel.html` above.

**There is no field that validates without being submitted.** v1's Stripe input carried no `name`, so v1 validated a card number it never sent. v2 keys the whole model off `name`: a nameless control is invisible to the engine — no validation, no gating, no bubble. Porting a real payment form, leave the card controls **unnamed** and let the payment SDK validate them, with the pre-submit hook supplying the token. The fixtures here name them only to exercise the `credit-card` and `cvv` types, and the numbers they post are test numbers. Do not copy that part to a live site.

**`min` and `max` do not apply to formatted text fields.** v1's `data-min-value` worked on anything. Choose: a `data-fs-type` format, or a native numeric range. Not both on one control.

## Engine Bugs This Port Surfaced

Three, all fixed with regression tests. The first two are in amount totals, fixed in `lib/behaviors.js` and pinned by `test/e2e/behaviors.spec.js` against the Conditional Amounts section of `instrumentation/operations.html`.

**An unchecked priced choice contributed its value.** A term read `el.value` regardless of whether the control was checked, so every option in a priced radio set summed at once — a $80/$30/$0 tier list totalled $110 no matter which tier was picked. A term now reads its value the way an expression reads a field's: an unchecked checkbox or radio is `''`.

**An irrelevant term kept counting, and nothing recomputed the total when relevance changed.** A term whose field had gone irrelevant was disabled and excluded from the payload, but still added to the visible total — money the server would never see. Worse, the total only recomputed on input to a term, so flipping the field that _drove_ the relevance did not recompute at all. A disabled control now contributes nothing, and the total recomputes on any input in the form.

**Every toggle flashed its native control at page load.** Found by screenshotting the ported forms rather than by a test. A `toggle-list` input is hidden with `opacity: 0` and covered by a drawn indicator, but that opacity rode the stylesheet's 150ms state transition, so each toggle faded in from a full native radio or checkbox the moment init added `fs-form` — native controls visibly sitting on top of their own labels. The opacity there is structure, not state, so the rule now opts out of the transition. Fixed in `lib/formsanity.css`, pinned in `test/e2e/states.spec.js`.
