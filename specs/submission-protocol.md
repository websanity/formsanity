# FormSanity Submission Protocol Specification

**Version:** 2. **Status:** normative.

A FormSanity form carries its rules in its markup, and a client engine enforces them in the browser. This document defines what happens after that: how the client sends the values of the form, what the server sends back, and what each side does with the message of the other side. Any backend can serve a FormSanity form without reading a client's source: Concrete, Node, PHP, Go, or a serverless function.

The companion document `vocabulary.md` defines the markup: the attributes, the rules they express, the three-state verdicts they produce, and the closed set of error codes. This document owns the wire. For the meaning of a rule, `vocabulary.md` is authoritative. For the shape of a payload, this document is authoritative.

## Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are used as defined in RFC 2119.

_Client_ means the implementation that sends the submission: the reference client engine in a browser, or anything else that speaks this protocol. _Server_ means the implementation that receives the submission. _Envelope_ means the JSON object that a server returns from a submission or a uniqueness check. _Reference client_ means `lib/submit.js` in this repository. _Reference server_ means `test/server.js`. Where this document describes their specific behavior, it says so. A conforming implementation is bound by the normative rules, not by the incidental choices of either reference.

## Protocol Version

Every response body in this protocol MUST carry the property `formsanity` with the integer value `2`. This is the major version of the protocol and the first thing a client reads.

Additive changes keep the integer: a new optional envelope property, a new error code, or a new field-value shape for markup that the vocabulary did not define before. A client written against version 2 MUST ignore envelope properties that it does not recognize. That rule is what makes those changes additive. Breaking changes bump the integer: a removed property, a changed property type, or a redefined code.

A client MUST reject an envelope whose `formsanity` value is not the version that the client speaks. The reference client requires an exact match. `formsanity` absent, `formsanity: 1`, and `formsanity: 3` all get the same treatment, as [protocol errors](#protocol-errors). None of them reach the `status` of the envelope. The reference client does not try to read a lower-versioned envelope, even when it can. A server that answers a version-2 request with a version-1 body is misconfigured, not only old. A server that speaks a later version MUST NOT downgrade silently. It answers with its own version and lets the client refuse it.

## Request

A submission is one HTTP request that carries every relevant answer in the form. The target comes from the markup. The encoding comes from the markup. The keys come from the markup. A client makes no decisions of its own about these three.

### Target

The client MUST `POST` the submission to the `action` URL of the form. When the form has no `action` attribute, the target is the current URL of the document.

Nothing else about the URL is specified. Query strings, path segments, and per-form endpoints all belong to the server. The client copies the attribute and does not interpret it.

### Encoding

The markup selects the body encoding, not the values.

| Condition                                           | Content type          | Body                                               |
| --------------------------------------------------- | --------------------- | -------------------------------------------------- |
| The form contains no `input[type="file"]`           | `application/json`    | A JSON object of field names to values             |
| The form contains at least one `input[type="file"]` | `multipart/form-data` | One part per value, boundary chosen by the browser |

A client MUST make this choice by the presence of a file control in the form. The choice does not depend on a selected file, and not on the relevance of the file field. A form with a file input that the person left empty still submits as `multipart/form-data`. Thus the encoding stays stable across the lifetime of a form, and a server route can be written against one parser.

For the multipart case, a client MUST NOT set the `Content-Type` header itself. The boundary parameter belongs to the code that assembles the body. The reference client passes a `FormData` object to `fetch`, and the browser writes the header.

`application/x-www-form-urlencoded` is not part of this protocol. A server MAY accept it as a convenience. The reference server does. No conforming client sends it.

### Field Names and Values

Payload keys are the `name` attributes of the controls, exactly as authored. A _field_ is every control in the form that shares one `name`, as `vocabulary.md` defines it. Each field contributes exactly one key.

| Field kind                                   | JSON value                              | Multipart parts                               |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| Text, `textarea`, `select`, `number`, `date` | The control's value, as a string        | One part carrying that string                 |
| Checkbox or radio set, any member count      | An array of the checked members' values | One part per checked value                    |
| File input                                   | Never — see Encoding                    | One part per selected file, with its filename |

A file field has no JSON form. A form with a file input always encodes as `multipart/form-data`, per the rule above. Thus a file value only exists as parts on the wire. No JSON body can carry one.

**Checked-value semantics are uniform.** A checkbox or radio field always serializes as an array of the `value` attributes of its checked controls, in document order. This includes a lone checkbox: it sends `["on"]` when checked and `[]` when not. Native HTML form submission is different: it omits an unchecked checkbox and sends a bare string for a checked one. With the uniform array, a server never has to guess if an absent key meant "unchecked" or "not submitted".

The two encodings differ on the empty case, and servers MUST absorb the difference. A field with an empty array appears in a JSON body as `[]`. In a `multipart/form-data` body, it produces no part at all. **A server MUST treat an absent key and an empty array as the same thing**: no answer.

Numbers and dates travel as the string value of the control, never as JSON numbers or ISO objects. The rules of `vocabulary.md` are all defined over the raw string. A server that parses before it validates has to re-derive what the client saw.

A `select[multiple]` submits like a checkbox choice group: an array of the values of the selected options, in document order. When nothing is selected, the key is absent or the array is empty.

### What Is Omitted

A client MUST omit an irrelevant field from the payload. Relevance is defined in `vocabulary.md`. A field whose `data-fs-relevant` expression is false does not appear as a key, in either encoding.

A client MUST also omit a field whose **first** control is `disabled`. In the reference client, this rule covers the irrelevant case too, because the reference client disables every control of an irrelevant field, in both presentation modes. But the rule stands on its own: an author-disabled control is not an answer.

The granularity is per field, not per control, on purpose. It does not reproduce native form encoding. A native submission drops each disabled control individually. The reference client tests only the first control, then includes or omits the whole field. For a multi-control field, the two disagree in both directions. A disabled but checked second member is still sent. A disabled first member drops members that are enabled. Thus authors MUST disable the controls of a field as a set. A partially disabled choice group is undefined, exactly as the vocabulary makes a partially relevant group undefined.

Nothing else is omitted. A field that the person left empty is sent as an empty string, or an empty array. "Answered with nothing" and "not asked" are different claims. Only the second one is the server's to infer.

### Hidden Fields

A server MAY render `input[type="hidden"]` elements into the form: a submission token, a page ID, a routing key, a form identifier. They need no FormSanity attribute.

**A client MUST round-trip the value of a hidden input byte for byte.** No trimming, no normalization, no re-encoding, and no reordering of characters. There is one exception: a hidden input that the author marks `data-fs-amount-total`. That attribute hands the value to the client engine, and the engine writes the computed sum into it. This is the author's transport for a total that an `<output>` shows elsewhere. The client gathers a hidden input as it gathers any other field, by its `name`. It never inspects the meaning of the value. Thus a hidden input with an opaque token is safe: what the server rendered is what the server receives.

A hidden input follows the same omission rules as any other field. Servers SHOULD NOT put a hidden input inside a row that can become irrelevant. The input is then disabled and dropped.

### Hook-Injected Fields

A client engine MAY offer a pre-submit hook API. The reference client's API is `addPreSubmitHook(form, asyncFn)`. Through the hook, site code contributes extra keys to the payload, after gathering and before the request. Stripe payment tokens, captcha responses, and analytics identifiers travel this way.

Injected keys are **opaque extras**. The client does not interpret them and does not validate them. The vocabulary says nothing about them. A server MAY require them, consume them, and reject a submission without them. It reports that failure as a [form-level error](#error-objects). Injected keys merge over the gathered payload, thus a hook can also overwrite the value of a gathered field. That is the choice of the site author, not the business of the protocol.

A hook that aborts MUST prevent the request entirely. The hooks of the reference client abort by a thrown error. No envelope exists in that case, so nothing in this document applies to it. The reference client shows its generic failure message and dispatches no event, because there is no server response to report.

### Transport

The reference client sends the request with `fetch` defaults: `credentials: "same-origin"`, no custom headers except `Content-Type` on the JSON path, and no cache directives. Two consequences matter for backend authors.

A same-origin endpoint receives the cookies of the site. Thus session-bound CSRF tokens and cookie-based authentication work without protocol support. A cross-origin endpoint receives **no** cookies, and MUST implement CORS. It MUST send `Access-Control-Allow-Origin` on the response. Without that header, the client sees a network failure and reports a protocol error. On the JSON path, the endpoint MUST also answer an `OPTIONS` preflight, because `Content-Type: application/json` is not a CORS-safelisted value. The multipart path causes no preflight from the protocol itself, because `multipart/form-data` is safelisted. But any header that a site adds around the request triggers one.

## Response Envelope

Every response to a submission MUST be a JSON object with `formsanity: 2` and a `status` string. The HTTP status code carries the outcome class for caches, proxies, logs, and non-browser clients. The body carries the detail.

| `status`   | HTTP status                 | Meaning                                                       |
| ---------- | --------------------------- | ------------------------------------------------------------- |
| `accepted` | `200 OK`                    | The submission was validated and stored, queued, or handled   |
| `invalid`  | `422 Unprocessable Content` | The submission failed validation; `errors` says how           |
| `error`    | Any other `4xx` or `5xx`    | Processing failed for a reason that is not the person's fault |

**A server MUST send `Content-Type: application/json` on every response in this protocol**: the three envelopes, the answer of the uniqueness check, and any body with a `429`. A charset parameter is permitted. The envelope is UTF-8 in each case, as JSON always is. The reference client does not enforce the header. It calls `response.json()` for every declared type, so a correct envelope with the label `text/html` still parses. That leniency is the private business of one client, not a license to mislabel. A proxy, a cache, or a non-browser consumer reads the header and can act on it.

Servers MUST send the HTTP status paired with the `status` value above. The reference client dispatches on the `status` of the body alone and never reads `response.status`. Thus a mismatched pair does not break it. But every other consumer of the endpoint reads the HTTP status, and a `200 OK` with `status: "invalid"` is a lie to all of them.

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

`message` and `redirect` are both optional. A server MAY send neither. Then the client marks the status region of the form as successful and renders no text.

**`redirect` wins over `message`.** When `redirect` is present and non-empty, the client MUST navigate to it and MUST NOT render `message`. The reference client calls `location.assign`, which leaves the page of the form in session history. The URL MAY be relative or absolute. The client does not validate it. A server that redirects to an attacker-supplied URL has an open-redirect bug of its own.

When `redirect` is absent, the client MUST render `message` as the submission result, or nothing when `message` is absent too. The client MUST mark the status region of the form as successful. The Status Region section of `vocabulary.md` defines that rendering: `p.fs-status-message` inside `div.fs-status.fs-success`.

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

`errors` MUST be present and MUST contain at least one entry. An `invalid` envelope with an empty or missing `errors` array tells the person nothing. The reference client renders no bubble, clears the processing state, and leaves the person before a form that silently refused them.

A server SHOULD report every failure that it found in one envelope, not only the first. Then the person corrects the form one time.

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

This is the envelope for a failure that the person cannot correct with an edit of the form: a storage error, an upstream timeout, a rejected payment, an expired token, a rate limit. The client shows the message to the person. Thus the message MUST NOT carry a stack trace, a query, or anything else that leaks the internals of the server.

A client MUST treat an unrecognized `status` value exactly as `error`. That rule is what makes a new outcome class an additive change. A version-2 client that meets a future `status` reports a generic failure and does not misread it as success.

### Error Objects

Each entry in `errors` is an object with three properties.

| Property  | Type             | Required | Semantics                                                                      |
| --------- | ---------------- | -------- | ------------------------------------------------------------------------------ |
| `field`   | string or `null` | REQUIRED | The `name` of the offending field, or `null` for a form-level failure          |
| `code`    | string           | REQUIRED | A code from the vocabulary's Code Reference — the machine-readable reason      |
| `message` | string           | OPTIONAL | Human-readable text; the client falls back to its own catalog entry for `code` |

`field` MUST be the `name` attribute of the field, not a label, an ID, or a database column. The client looks the name up in the model of the form and lands the error as a real `invalid` verdict on that field. The bubble shows, the standing "fix the highlighted fields" line appears, and the submit gate closes. This is the same accounting that a client-side invalid drives. The verdict holds until the person edits the field. The client cannot re-derive a server judgment. Thus an edit clears the verdict, and the server gets its next say at the resubmit.

**`field` is `null` for a form-level failure**: a spam rejection, a missing token, an expired session, or a cross-record conflict that belongs to no single input. The client renders each form-level error as its own line in the status region of the form (`p.fs-status-error`, per `vocabulary.md`), not as a field bubble.

A `field` that names a field the form does not contain degrades to form-level. The reference client fails the lookup and renders the message in the status region. It does not drop the message. Servers MUST NOT use that as an addressing mechanism. The rule exists so that a renamed or removed field cannot silently swallow an error. Servers SHOULD send `null` when they mean form-level.

`code` MUST come from the closed set below. `message` is a fallback, not the payload. A client can ignore the wording of the server and render its own catalog entry for the code. That is how a localized front end stays localized against an English backend. A server that wants its wording shown SHOULD send it, and SHOULD assume that the client can override it.

### Protocol Errors

A _protocol error_ is the verdict of the client when it cannot read a response at all. It is not an envelope, and it is not the server's `error` status. It is the failure to have a conversation.

A client MUST report a protocol error when any of these conditions hold.

| Condition                            | Example                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| The request never completed          | A dropped connection, a DNS failure, a blocked cross-origin request    |
| The body is not parseable JSON       | An HTML error page from a proxy, an empty body, a PHP fatal-error dump |
| The body parses but is not an object | `null`, a bare string, an array                                        |
| `formsanity` is absent or is not `2` | A version-1 backend, a misrouted endpoint, a version-3 backend         |

In each of those cases, the client MUST NOT guess. The reference client marks the status region as failed, renders its own catalog line, _"Unexpected response from the server."_, and dispatches `fs:error` with the unusable body, or `null`, as the `envelope` of the event. It never falls through to a read of `status`. Thus a body with `status: "accepted"` but without a correct `formsanity` is not an acceptance.

The client does not consult the HTTP status code here either. A `500` with a well-formed `error` envelope is an error envelope, handled normally with the message of the server. A `500` with an HTML stack trace is a protocol error, and the person sees the generic line. **Thus a server MUST answer JSON on every path a submission can take**, which includes the unhandled-exception page of its framework and the timeout page of its reverse proxy. An endpoint that returns HTML when it breaks has left the protocol at exactly the moment it most needs to say something.

## Error Codes

The codes belong to the vocabulary, not to this protocol. **The Code Reference table of `vocabulary.md` is the single registry.** It lists every code with the rule that raises it and the verdict of a violation. This document does not restate it.

Two properties of that registry matter to the protocol. First, the registry is **closed for version 2**. A new code is an additive change for a future version, and a client MUST NOT be expected to recognize a code outside the registry. Second, one code in the registry is raised only by a server: `relevance`, reported when a non-empty value arrives for a field that the markup makes irrelevant. A client can render it, because it has a catalog entry for it, but a client never raises it. See [Relevance](#relevance) below.

A server MAY report a condition that the vocabulary does not describe, with a code prefixed `x-`: `x-blocked`, `x-payment-declined`, `x-quota`. Prefixed codes are the extension point. They stay outside the registry permanently, so no future version will collide with one. A client MUST NOT be expected to understand an `x-` code. The code has no catalog entry. Thus a server that sends one MUST also send a `message`, or the person sees the generic fallback text of the client.

## Server Obligations

Three obligations make a server conforming, not only responsive. They exist because the enforcement of the client protects the person who fills in the form, and nothing else.

### Re-Validation

**A server MUST re-validate every submitted field against the markup of the form.** The acceptance of the client is a convenience for the person, never evidence about the payload. The request is an ordinary HTTP POST that anything can send, with any keys and any values.

The Scope and Conformance section of `vocabulary.md` defines what that means concretely. A conforming server parser implements the native register, the `data-fs-*` rules, and relevance. It ignores the behavior and presentation attributes entirely. The server reports failures as [error objects](#error-objects) with the codes of the vocabulary, in an `invalid` envelope.

Re-validation requires the markup. How a server obtains the markup is outside this protocol: a re-rendered template, a stored form definition, or a parsed saved document. What matters: the markup that a server validates against MUST be the markup that it rendered for that form. Without that rule, a hostile client can submit against rules that no longer exist.

### Relevance

A server MUST evaluate the `data-fs-relevant` expression of each field against the **submitted payload**. It MUST use the same grammar and the same value readings that the vocabulary defines. A field absent from the payload reads as the empty string, exactly as an unanswered field reads in the browser.

**A server MUST reject a non-empty value submitted for an irrelevant field**, with the code `relevance` on that field. Without that rule, relevance is a suggestion that a hostile client ignores, and every rule behind a relevance condition becomes optional.

A server MUST treat an **empty** value for an irrelevant field as absent, not reject it. The Server Obligation section of `vocabulary.md` gives the reasons: several honest paths produce an empty key for an irrelevant field, and an empty value asserts no answer.

The rules of an irrelevant field itself are inert. A server MUST NOT enforce `required`, a type, or any other rule against a field that its relevance expression excludes.

### Unknown Fields

A payload MAY contain keys that the markup does not define: a hook-injected token, an extra key from a stale cached page, or a probe from an attacker.

**A server MUST NOT treat an unknown key as an authored answer.** It MUST NOT store one as if the form had asked for it. It MUST NOT let one reach a template, a query, or an email body without validation of its own.

After that, a server takes one of two documented positions, and it SHOULD state which one in its own documentation:

- **Ignore.** Drop every key that is neither a known field nor a known extra. Simple and forgiving. Correct for a public endpoint that can receive stale submissions after a form edit.
- **Reject.** Answer `invalid` with a form-level error when an unknown non-hidden key appears. Stricter. It surfaces the drift that the ignoring server hides.

The reference server takes neither position, because it performs no validation at all. It is a protocol-shape reference, and it ignores everything that its scenario routing does not need. A production server MUST choose.

## Uniqueness Sub-Protocol

`data-fs-unique="url"` puts a server-checked uniqueness rule on a field. The value of the attribute is the check endpoint. The meaning of the rule belongs to the vocabulary. The exchange belongs to this document.

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

The endpoint MAY be the same URL for every field on a site. `field` tells the endpoint which uniqueness domain to consult. Or the site uses one URL per field.

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

A server MUST send `formsanity: 2` here, as in every other response. Note: the reference client does not verify it on this path. It presents the field as not-unique when, and only when, the body parses to an object with `unique === false`. Every other outcome counts as "no objection": `unique: true`, a missing property, an unparseable body, a `4xx`. This asymmetry is deliberate. The check is advisory. A check that cannot answer MUST NOT block a person who is typing.

### Rate Limiting

A server MAY answer `429 Too Many Requests` to throttle checks. The client ignores the body, which MAY be empty.

A client that receives `429` MUST back off silently. It MUST NOT mark the field invalid. It MUST leave the verdict of the field where the rest of validation put it. It MUST NOT retry automatically. A throttled check has learned nothing about the value.

The reference client goes one step further and clears the error bubble of the field. That also removes a bubble that another rule had put there. Nothing is lost in practice, because a check only runs on a field whose verdict is already `valid`, and such a field has no other bubble.

A network failure gets identical handling. Silence is never evidence of a duplicate.

### Client Back-Off and Staleness

The interactive check is a courtesy. A conforming client MUST keep it from a keystroke flood and from stale verdicts. The discipline of the reference client:

| Guard          | Behavior                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Trigger        | Fires on `focusout`, never on `input` — a value is checked once the person leaves the field    |
| Precondition   | Skips the check entirely when the value is empty or the field's own verdict is not yet `valid` |
| Debounce       | Waits 300 ms after `focusout`; a re-focus and second exit within that window cancels the first |
| Sequence guard | Each check takes a sequence number; a response whose number is stale is discarded, not applied |

The sequence guard prevents the classic bug: a slow check on an old value resolves after a fast check on the new value, and overwrites the correct verdict with an obsolete one.

### Submission Is Authoritative

**The interactive check never decides anything.** A server MUST re-check uniqueness when the submission arrives, and MUST reject a duplicate there, with the code `unique` on the field, in an `invalid` envelope.

This is not a redundant safety layer. It is the only correct place for the decision. The interactive check answers a question about a moment that has passed. Between that moment and the submission, another person can take the value. A server that trusts the advisory check has a race. A server that skips the submission-time check has no uniqueness at all.

## Security and Exclusions

The following are outside this protocol.

- **Authentication and sessions.** Whether an endpoint requires a signed-in person, and how it knows, is the design of the server. Same-origin submissions carry cookies. Cross-origin submissions do not.
- **CSRF defense.** A server that needs a token renders it as a hidden input and reads it back from the payload, with the [round-trip guarantee](#hidden-fields). No FormSanity attribute is involved.
- **Captcha verification.** The token of the captcha widget reaches the payload as a [hook-injected field](#hook-injected-fields). The client does not know that it is a captcha token. The server verifies it with its provider and reports failure as a form-level error, or as an `error` envelope.
- **Payment authorization.** Payment tokens travel the same way, as opaque extras. The library never learns what they mean.
- **Storage.** Where a submission goes, what it is called there, how long it lives, and what notifications it triggers are all the business of the server. This protocol ends at the envelope.
- **Spam heuristics and rate limits on submissions.** A server MAY reject on any grounds. It reports `invalid` with a form-level error, or an `error` envelope with a matching HTTP status.

This protocol asserts one security property: **a server MUST NOT trust a submitted value because a client accepted it.** Every claim in [Server Obligations](#server-obligations) follows from that.

## Reference Implementation

`test/server.js` in this repository is an executable reference. It implements the envelope shapes, the version property, and the uniqueness sub-protocol in a few hundred lines of dependency-free Node. When this document is ambiguous, read that artifact. It parses `application/json` and `multipart/form-data`, plus `application/x-www-form-urlencoded` as a convenience beyond the protocol. It also serves the static files of the repository, so one process backs both the demo pages and their submissions.

It is a **test fixture, not a backend**. It performs no validation, stores nothing, and drives its responses from query parameters, so the end-to-end suite can demand a specific envelope. The routes below are test conveniences with no standing in this protocol. A production endpoint has one behavior per URL, decided by the payload.

| Route                                | Behavior                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/submit`                   | `200` `accepted` with `message: "Thanks!"`                                                                                          |
| `POST /api/submit?scenario=invalid`  | `422` `invalid`; the payload's `reject` key, `"field:code,field:code"`, shapes `errors`, defaulting to one `email` / `unique` entry |
| `POST /api/submit?scenario=redirect` | `200` `accepted` with a `redirect` URL                                                                                              |
| `POST /api/submit?scenario=error`    | `500` `error` with `message: "Could not store submission"`                                                                          |
| `POST /api/unique`                   | `200` with `unique: false` for a small fixed set of taken values                                                                    |

Its `/api/unique` route also simulates throttling: every third call in a two-second window answers `429` with an empty body. That is how the end-to-end suite proves the back-off of the client. Real throttling policy belongs to each server.
