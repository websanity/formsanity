# FormSanity Submission Protocol Specification

**Version:** 2. **Status:** normative.

A FormSanity form carries its rules in its markup, and a client engine enforces them in the browser. This document defines what happens after that: how the client sends the form's values, what the server must send back, and what each side must do with the other's message. It is written so that any backend — Concrete, Node, PHP, Go, a serverless function — can serve a FormSanity form without reading a client's source.

The companion document `vocabulary.md` defines the markup: the attributes, the rules they express, the three-state verdicts they produce, and the closed set of error codes. This document owns the wire. Where a rule's meaning is at stake, `vocabulary.md` is authoritative; where a payload's shape is at stake, this document is.

## Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as defined in RFC 2119.

_Client_ means the implementation that sends the submission — the reference client engine in a browser, or anything else speaking this protocol. _Server_ means the implementation that receives it. _Envelope_ means the JSON object a server returns from a submission or a uniqueness check. _Reference client_ means this repository's `lib/submit.js`, and _reference server_ means `test/server.js`; where this document describes their behavior specifically it says so, because a conforming implementation is bound by the normative rules, not by either reference's incidental choices.

## Protocol Version

Every response body this protocol defines MUST carry the property `formsanity` with the integer value `2`. It is the protocol's major version and the first thing a client reads.

Additive changes keep the integer: a new optional envelope property, a new error code, a new field-value shape for markup the vocabulary did not previously define. A client written against version 2 MUST ignore envelope properties it does not recognize, which is what makes those changes additive. Breaking changes — removing a property, changing a property's type, redefining an existing code — bump the integer.

A client MUST reject any envelope whose `formsanity` value is not the version it speaks. The reference client requires an exact match: `formsanity` absent, `formsanity: 1`, and `formsanity: 3` are all treated identically, as [protocol errors](#protocol-errors), and none of them reach the envelope's `status`. It does not attempt to read a lower-versioned envelope even though it might understand one, because a server that answers a version-2 request with a version-1 body is misconfigured, not merely old. Servers speaking a later version MUST NOT downgrade silently; they answer with their own version and let the client refuse it.

## Request

A submission is one HTTP request carrying every relevant answer the form holds. Its target comes from the markup, its encoding comes from the markup, and its keys come from the markup — a client makes no decisions of its own about any of the three.

### Target

The client MUST `POST` the submission to the form's `action` URL. When the form has no `action` attribute, the target is the document's current URL.

Nothing else about the URL is specified. Query strings, path segments, and per-form endpoints are all the server's business, and the client copies the attribute without interpreting it.

### Encoding

The body encoding is chosen from the markup, not from the values.

| Condition                                           | Content type          | Body                                               |
| --------------------------------------------------- | --------------------- | -------------------------------------------------- |
| The form contains no `input[type="file"]`           | `application/json`    | A JSON object of field names to values             |
| The form contains at least one `input[type="file"]` | `multipart/form-data` | One part per value, boundary chosen by the browser |

A client MUST make this choice by the presence of a file control in the form, not by whether a file was selected and not by whether the file field is relevant. A form with a file input that the person left empty still submits as `multipart/form-data`. This keeps the encoding stable across a form's lifetime, so a server route can be written against one parser.

A client MUST NOT set the `Content-Type` header itself for the multipart case; the boundary parameter belongs to whatever assembles the body. The reference client passes a `FormData` object to `fetch` and lets the browser write the header.

`application/x-www-form-urlencoded` is not part of this protocol. A server MAY accept it as a convenience — the reference server does — but no conforming client sends it.

### Field Names and Values

Payload keys are the controls' `name` attributes, exactly as authored. A _field_ is every control in the form sharing one `name`, as `vocabulary.md` defines it, and it contributes exactly one key.

| Field kind                                   | JSON value                              | Multipart parts                               |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| Text, `textarea`, `select`, `number`, `date` | The control's value, as a string        | One part carrying that string                 |
| Checkbox or radio set, any member count      | An array of the checked members' values | One part per checked value                    |
| File input                                   | Never — see Encoding                    | One part per selected file, with its filename |

A file field has no JSON form. A form holding a file input always encodes as `multipart/form-data`, per the rule above, so a file value only ever exists as parts on the wire — there is no JSON body a server can receive one in.

**Checked-value semantics are uniform.** A checkbox or radio field always serializes as an array of the `value` attributes of its checked controls, in document order — including a lone checkbox, which sends `["on"]` when checked and `[]` when not. This differs from a native HTML form submission, which omits an unchecked checkbox entirely and sends a bare string for a checked one. The uniform array means a server never has to guess whether a key's absence meant "unchecked" or "not submitted".

The two encodings are asymmetric on the empty case, and servers MUST absorb the difference: a field whose array is empty appears in a JSON body as `[]`, but produces no part at all in a `multipart/form-data` body. **A server MUST treat an absent key and an empty array as the same thing** — no answer.

Numbers and dates travel as the control's string value, never as JSON numbers or ISO objects. `vocabulary.md`'s rules are all defined over the raw string, so a server that parses before it validates has to re-derive what the client saw.

The vocabulary defines no multi-selection `select`. A `select[multiple]` is outside the vocabulary, and the reference client serializes only its first selected value; authors who need multiple answers MUST use a checkbox choice group.

### What Is Omitted

A client MUST omit an irrelevant field from the payload. Relevance is defined in `vocabulary.md`; a field whose `data-fs-relevant` expression is false does not appear as a key, in either encoding.

A client MUST also omit a field whose **first** control is `disabled`. This subsumes the irrelevant case in the reference client, which disables every control of an irrelevant field in both `hidden` and `disabled` presentation modes, but the rule stands on its own: an author-disabled control is not an answer.

The granularity is deliberately per field, not per control, and it does not reproduce native form encoding. A native submission drops each disabled control individually; the reference client tests only the first control and then includes or omits the whole field. For a multi-control field the two disagree in both directions — a disabled but checked second member is still sent, and disabling only the first member drops members that are enabled. Authors MUST therefore disable a field's controls as a set. Disabling part of a choice group is undefined, exactly as the vocabulary makes a partially-relevant group undefined.

Nothing else is omitted. A field left empty by the person is sent as an empty string (or an empty array), because "answered with nothing" and "not asked" are different claims and only the second one is the server's to infer.

### Hidden Fields

A server MAY render `input[type="hidden"]` elements into the form — a submission token, a page ID, a routing key, a form identifier. They need no FormSanity attribute.

**A client MUST round-trip a hidden input's value byte for byte**, with no trimming, no normalization, no re-encoding, and no reordering of characters. The client gathers a hidden input as it gathers any other field, by its `name`, and never inspects the value's meaning. A hidden input carrying an opaque token is therefore safe: what the server rendered is what the server receives.

A hidden input is subject to the same omission rules as any other field. Servers SHOULD NOT put a hidden input inside a row that can become irrelevant, because it will then be disabled and dropped.

### Hook-Injected Fields

A client engine MAY offer a pre-submit hook API — the reference client's is `addPreSubmitHook(form, asyncFn)` — through which site code contributes extra keys to the payload after gathering and before the request. Stripe payment tokens, captcha responses, and analytics identifiers travel this way.

Injected keys are **opaque extras**: the client neither interprets them nor validates them, and the vocabulary says nothing about them. A server MAY require them, consume them, and reject a submission that lacks them, reporting the failure as a [form-level error](#error-objects). Because injected keys are merged over the gathered payload, a hook can also overwrite a gathered field's value; that is the site author's choice, not the protocol's business.

A hook that aborts — the reference client's hooks abort by throwing — MUST prevent the request entirely. No envelope exists in that case, so nothing in this document applies to it: the reference client shows its generic failure message and dispatches no event, because there is no server response to report.

### Transport

The reference client sends the request with `fetch` defaults: `credentials: "same-origin"`, no custom headers beyond `Content-Type` on the JSON path, and no cache directives. Two consequences are worth stating for backend authors.

A same-origin endpoint receives the site's cookies, so session-bound CSRF tokens and cookie-based authentication work without any protocol support. A cross-origin endpoint receives **no** cookies, and MUST implement CORS: it MUST send `Access-Control-Allow-Origin` on the response, or the client will see a network failure and report a protocol error. On the JSON path it MUST also answer an `OPTIONS` preflight, because `Content-Type: application/json` is not a CORS-safelisted value. The multipart path preflights on nothing of the protocol's making — `multipart/form-data` is safelisted — but any header a site adds around the request will trigger one anyway.

## Response Envelope

Every response to a submission MUST be a JSON object carrying `formsanity: 2` and a `status` string. The HTTP status code carries the outcome class for caches, proxies, logs, and non-browser clients; the body carries the detail.

| `status`   | HTTP status                 | Meaning                                                       |
| ---------- | --------------------------- | ------------------------------------------------------------- |
| `accepted` | `200 OK`                    | The submission was validated and stored, queued, or handled   |
| `invalid`  | `422 Unprocessable Content` | The submission failed validation; `errors` says how           |
| `error`    | Any other `4xx` or `5xx`    | Processing failed for a reason that is not the person's fault |

**A server MUST send `Content-Type: application/json` on every response this protocol defines** — the three envelopes, the uniqueness check's answer, and any body accompanying a `429`. A charset parameter is permitted; the envelope is UTF-8 either way, as JSON always is. The reference client does not enforce this: it calls `response.json()` regardless of the declared type, so a correct envelope mislabeled `text/html` still parses. That leniency is a client's private business and not a license to mislabel — a proxy, a cache, or a non-browser consumer reads the header and is entitled to act on it.

Servers MUST send the HTTP status paired with the `status` value above. The reference client dispatches on the body's `status` alone and never reads `response.status` — so a mismatched pair will not break it — but every other consumer of the endpoint reads the HTTP status, and a `200 OK` carrying `status: "invalid"` is a lie to all of them.

### Accepted

```json
{
	"formsanity": 2,
	"status": "accepted",
	"message": "Thanks for joining!",
	"redirect": "https://example.org/welcome"
}
```

| Property     | Type    | Required | Semantics                                                   |
| ------------ | ------- | -------- | ----------------------------------------------------------- |
| `formsanity` | integer | REQUIRED | Always `2`                                                  |
| `status`     | string  | REQUIRED | Always `"accepted"`                                         |
| `message`    | string  | OPTIONAL | Success text the client renders in the form's status region |
| `redirect`   | string  | OPTIONAL | URL the client navigates to instead of rendering a message  |

`message` and `redirect` are both optional and a server MAY send neither, in which case the client marks the form's status region successful and renders no text.

**`redirect` wins over `message`.** When `redirect` is present and non-empty, the client MUST navigate to it and MUST NOT render `message`; the reference client calls `location.assign`, which leaves the form's page in session history. The URL MAY be relative or absolute, and the client does not validate it — a server that redirects to an attacker-supplied URL has an open-redirect bug of its own making.

When `redirect` is absent, the client MUST render `message` (or nothing, when it is absent too) as the submission result and MUST mark the form's status region as successful. `vocabulary.md`'s Status Region section defines that rendering: `p.fs-status-message` inside `div.fs-status.fs-success`.

v1's convention of smuggling a redirect URL through the message string is retired. So is the `Validation Error` magic string, and so is the `{ok, result}` double wrapping.

### Invalid

```json
{
	"formsanity": 2,
	"status": "invalid",
	"errors": [
		{ "field": "email", "code": "type.email", "message": "Not a valid email address" }
	]
}
```

| Property     | Type             | Required | Semantics                                          |
| ------------ | ---------------- | -------- | -------------------------------------------------- |
| `formsanity` | integer          | REQUIRED | Always `2`                                         |
| `status`     | string           | REQUIRED | Always `"invalid"`                                 |
| `errors`     | array of objects | REQUIRED | One entry per rejected field or form-level failure |

`errors` MUST be present and MUST contain at least one entry. An `invalid` envelope with an empty or missing `errors` array tells the person nothing: the reference client renders no bubble, clears the processing state, and leaves them staring at a form that silently refused them.

A server SHOULD report every failure it found in one envelope rather than the first, so the person fixes the form once.

### Error

```json
{
	"formsanity": 2,
	"status": "error",
	"message": "Could not store submission"
}
```

| Property     | Type    | Required | Semantics                                                     |
| ------------ | ------- | -------- | ------------------------------------------------------------- |
| `formsanity` | integer | REQUIRED | Always `2`                                                    |
| `status`     | string  | REQUIRED | Always `"error"`                                              |
| `message`    | string  | OPTIONAL | Failure text the client renders; it falls back to its catalog |

This is the envelope for a failure the person cannot fix by editing the form: a storage error, an upstream timeout, a rejected payment, an expired token, a rate limit. The message is shown to the person, so it MUST NOT carry a stack trace, a query, or anything else that leaks the server's internals.

A client MUST treat any `status` value it does not recognize exactly as `error`. That is what makes a new outcome class an additive change: a version-2 client meets a future `status` and reports a generic failure instead of misreading it as success.

### Error Objects

Each entry in `errors` is an object with three properties.

| Property  | Type             | Required | Semantics                                                                      |
| --------- | ---------------- | -------- | ------------------------------------------------------------------------------ |
| `field`   | string or `null` | REQUIRED | The `name` of the offending field, or `null` for a form-level failure          |
| `code`    | string           | REQUIRED | A code from the vocabulary's Code Reference — the machine-readable reason      |
| `message` | string           | OPTIONAL | Human-readable text; the client falls back to its own catalog entry for `code` |

`field` MUST be the field's `name` attribute, not a label, an ID, or a database column. The client looks the name up in the form's model and attaches the error to that field's error bubble.

**`field` is `null` for a form-level failure** — a spam rejection, a missing token, an expired session, a cross-record conflict that belongs to no single input. The client renders each form-level error as its own line in the form's status region (`p.fs-status-error`, per `vocabulary.md`), not as a field bubble.

A `field` naming a field the form does not contain degrades to form-level: the reference client fails the lookup and renders the message in the status region rather than dropping it. Servers MUST NOT rely on that as an addressing mechanism — it exists so that a renamed or removed field cannot silently swallow an error — and SHOULD send `null` when they mean form-level.

`code` MUST come from the closed set below. `message` is a fallback, not the payload: a client is entitled to ignore the server's wording and render its own catalog entry for the code, which is how a localized front end stays localized against an English backend. A server that wants its wording shown SHOULD send it and SHOULD assume it may be overridden.

### Protocol Errors

A _protocol error_ is the client's verdict when it cannot read a response at all. It is not an envelope, and it is not the server's `error` status — it is the failure to have a conversation.

A client MUST report a protocol error when any of these hold.

| Condition                            | Example                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| The request never completed          | A dropped connection, a DNS failure, a blocked cross-origin request    |
| The body is not parseable JSON       | An HTML error page from a proxy, an empty body, a PHP fatal-error dump |
| The body parses but is not an object | `null`, a bare string, an array                                        |
| `formsanity` is absent or is not `2` | A version-1 backend, a misrouted endpoint, a version-3 backend         |

In every one of those cases the client MUST NOT guess. The reference client marks the status region as failed, renders its own catalog line — _"Unexpected response from the server."_ — and dispatches `fs:error` with the unusable body, or `null`, as the event's `envelope`. It never falls through to reading `status`, so a body that carries `status: "accepted"` without a correct `formsanity` is not an acceptance.

The HTTP status code is not consulted here either. A `500` carrying a well-formed `error` envelope is an error envelope, handled normally with the server's message; a `500` carrying an HTML stack trace is a protocol error, and the person sees the generic line. **A server MUST therefore answer JSON on every path a submission can take**, including its framework's unhandled-exception page and its reverse proxy's timeout page. An endpoint that returns HTML when it breaks has silently opted out of the protocol at exactly the moment it most needs to say something.

## Error Codes

The codes are the vocabulary's, not this protocol's. **`vocabulary.md`'s Code Reference table is the single registry**, and it lists every code with the rule that raises it and the verdict a violation produces. This document does not restate it.

Two properties of that registry are protocol-relevant. First, it is **closed for version 2**: adding a code is an additive change that a future version makes, and a client MUST NOT be expected to recognize a code outside it. Second, one code in it is raised only by a server — `relevance`, reported when a non-empty value arrives for a field the markup says is irrelevant. A client can render it, having a catalog entry for it, but never raises it itself; see [Relevance](#relevance) below.

A server MAY report a condition the vocabulary does not describe by using a code prefixed `x-` — `x-blocked`, `x-payment-declined`, `x-quota`. Prefixed codes are the extension point, and they are permanently outside the registry, so no future version will collide with one. A client MUST NOT be expected to understand an `x-` code: it has no catalog entry, so a server sending one MUST also send a `message`, or the person sees the client's generic fallback text.

## Server Obligations

Three obligations make a server conforming rather than merely responsive. They exist because the client's enforcement protects the person filling in the form, and nothing else.

### Re-Validation

**A server MUST re-validate every submitted field against the form's markup.** The client's acceptance is a convenience for the person, never evidence about the payload: the request is an ordinary HTTP POST that anything can send, with any keys and any values.

`vocabulary.md`'s Scope and Conformance section defines what that means concretely — a conforming server parser implements the native register, the `data-fs-*` rules, and relevance, and ignores the behavior and presentation attributes entirely. Failures are reported as [error objects](#error-objects) with the vocabulary's codes, in an `invalid` envelope.

Re-validation requires the markup. How a server obtains it — re-rendering the template, reading a stored form definition, parsing a saved document — is outside this protocol. What matters is that the markup a server validates against MUST be the markup it rendered for that form, or a hostile client can submit against rules that no longer exist.

### Relevance

A server MUST evaluate each field's `data-fs-relevant` expression against the **submitted payload**, using the same grammar and the same value readings the vocabulary defines. A field absent from the payload reads as the empty string, exactly as an unanswered field reads in the browser.

**A non-empty value submitted for an irrelevant field MUST be rejected**, with the code `relevance` on that field. Without that rule, relevance is a suggestion any hostile client ignores, and every rule guarded by a relevance condition becomes optional.

An **empty** value for an irrelevant field MUST be treated as absent, not rejected. `vocabulary.md`'s Server Obligation section gives the reasoning: several honest paths produce an empty key for an irrelevant field, and an empty value asserts no answer.

An irrelevant field's own rules are inert. A server MUST NOT enforce `required`, a type, or any other rule against a field its relevance expression excludes.

### Unknown Fields

A payload MAY contain keys the markup does not define — a hook-injected token, an extra key from a stale cached page, or a probe from an attacker.

**A server MUST NOT treat an unknown key as an authored answer.** It MUST NOT store one as if the form had asked for it, and MUST NOT let one reach a template, a query, or an email body without validation of its own.

Beyond that, a server takes one of two documented positions, and it SHOULD state which in its own documentation:

- **Ignore.** Drop every key that is neither a known field nor a known extra. Simple and forgiving; appropriate for a public endpoint that may receive stale submissions after a form is edited.
- **Reject.** Answer `invalid` with a form-level error when an unknown non-hidden key appears. Stricter, and it surfaces the drift that the ignoring server hides.

The reference server takes neither position, because it performs no validation at all — it is a protocol-shape reference, and it ignores everything it does not need for its scenario routing. A production server MUST choose.

## Uniqueness Sub-Protocol

`data-fs-unique="url"` puts a server-checked uniqueness rule on a field, with the attribute's value as the check endpoint. The rule's meaning is the vocabulary's; the exchange is this document's.

### The Check Request

The client MUST `POST` to the endpoint URL with `Content-Type: application/json` and this body.

```json
{
	"field": "email",
	"value": "person@example.org"
}
```

| Property | Type   | Required | Semantics                    |
| -------- | ------ | -------- | ---------------------------- |
| `field`  | string | REQUIRED | The field's `name` attribute |
| `value`  | string | REQUIRED | The value to test, as typed  |

The endpoint MAY be the same URL for every field on a site — `field` is what tells it which uniqueness domain to consult — or one URL per field.

### The Check Response

```json
{
	"formsanity": 2,
	"unique": true
}
```

| Property     | Type    | Required | Semantics                               |
| ------------ | ------- | -------- | --------------------------------------- |
| `formsanity` | integer | REQUIRED | Always `2`                              |
| `unique`     | boolean | REQUIRED | `false` when the value is already taken |

A server MUST send `formsanity: 2` here as in every other response. Note that the reference client does not verify it on this path: it presents the field as not-unique when and only when the body parses to an object with `unique === false`, and treats every other outcome — `unique: true`, a missing property, an unparseable body, a `4xx` — as "no objection". The asymmetry is deliberate. This check is advisory, and a check that cannot answer MUST NOT be allowed to block a person who is typing.

### Rate Limiting

A server MAY answer `429 Too Many Requests` to throttle checks. The body is ignored and MAY be empty.

A client receiving `429` MUST back off silently: it MUST NOT mark the field invalid, MUST leave the field's verdict where the rest of validation put it, and MUST NOT retry automatically. A throttled check has learned nothing about the value.

The reference client goes one step further and clears the field's error bubble outright, which would also remove a bubble another rule had put there. Nothing is lost in practice, because a check only runs on a field whose verdict is already `valid` and therefore has no other bubble to clear.

A network failure is handled identically. Silence is never evidence of a duplicate.

### Client Back-Off and Staleness

The interactive check is a courtesy, and a conforming client MUST keep it from becoming a keystroke firehose or a source of stale verdicts. The reference client's discipline:

| Guard          | Behavior                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Trigger        | Fires on `focusout`, never on `input` — a value is checked once the person leaves the field    |
| Precondition   | Skips the check entirely when the value is empty or the field's own verdict is not yet `valid` |
| Debounce       | Waits 300 ms after `focusout`; a re-focus and second exit within that window cancels the first |
| Sequence guard | Each check takes a sequence number; a response whose number is stale is discarded, not applied |

The sequence guard is what prevents the classic bug: a slow check on an old value resolving after a fast check on the new one and overwriting the correct verdict with an obsolete one.

### Submission Is Authoritative

**The interactive check never decides anything.** A server MUST re-check uniqueness when the submission arrives and MUST reject a duplicate there, with the code `unique` on the field, in an `invalid` envelope.

This is not belt-and-braces; it is the only correct place for the decision. The interactive check answers a question about a moment that has passed, and between that moment and the submission another person can take the value. A server that trusts the advisory check has a race, and a server that skips the submission-time check has no uniqueness at all.

## Security and Exclusions

The following are outside this protocol.

- **Authentication and sessions.** Whether an endpoint requires a signed-in person, and how it knows, is the server's design. Same-origin submissions carry cookies; cross-origin ones do not.
- **CSRF defense.** A server that needs a token renders it as a hidden input and reads it back from the payload, using the [round-trip guarantee](#hidden-fields). No FormSanity attribute is involved.
- **Captcha verification.** The captcha widget's token reaches the payload as a [hook-injected field](#hook-injected-fields). The client does not know it is a captcha token; the server verifies it with its provider and reports failure as a form-level error, or as an `error` envelope.
- **Payment authorization.** Payment tokens travel the same way, as opaque extras. The library never learns what they mean.
- **Storage.** Where a submission goes, what it is called there, how long it lives, and what notifications it triggers are all the server's business. This protocol ends at the envelope.
- **Spam heuristics and rate limiting of submissions.** A server MAY reject on any grounds it likes, reporting `invalid` with a form-level error or an `error` envelope with an appropriate HTTP status.

One security property this protocol does assert: **a server MUST NOT trust a submitted value because a client accepted it.** Every claim in [Server Obligations](#server-obligations) follows from that.

## Reference Implementation

`test/server.js` in this repository is an executable reference. It implements the envelope shapes, the version property, and the uniqueness sub-protocol in a couple hundred lines of dependency-free Node, and it is the artifact to read when this document is ambiguous. It parses `application/json`, `multipart/form-data`, and — as a convenience beyond the protocol — `application/x-www-form-urlencoded`. It also serves the repository's static files, so one process backs both the instrumentation pages and their submissions.

It is a **test fixture, not a backend**. It performs no validation, stores nothing, and drives its responses from query parameters so the end-to-end suite can demand a specific envelope. The routes below are test conveniences with no standing in this protocol; a production endpoint has one behavior per URL, decided by the payload.

| Route                                | Behavior                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/submit`                   | `200` `accepted` with `message: "Thanks!"`                                                                                          |
| `POST /api/submit?scenario=invalid`  | `422` `invalid`; the payload's `reject` key, `"field:code,field:code"`, shapes `errors`, defaulting to one `email` / `unique` entry |
| `POST /api/submit?scenario=redirect` | `200` `accepted` with a `redirect` URL                                                                                              |
| `POST /api/submit?scenario=error`    | `500` `error` with `message: "Could not store submission"`                                                                          |
| `POST /api/unique`                   | `200` with `unique: false` for a small fixed set of taken values                                                                    |

Its `/api/unique` route also simulates throttling: every third call within a two-second window answers `429` with an empty body, which is how the end-to-end suite proves the client's back-off. Real throttling policy is a server's own.
