# FormSanity for PHP

This page shows a PHP application how to validate FormSanity submissions with the package in `php/`. The two specs are the full definition. Where this page and a spec disagree, the spec is correct.

## What It Is

The package `websanity/formsanity` implements the server side of FormSanity in PHP. It is the **server parser** conformance class of the vocabulary spec, and the envelope layer of the submission protocol. [Scope and Conformance](../specs/vocabulary.md#scope-and-conformance) defines the class.

You give the package the markup of one form and the payload of one submission. It answers with a result: the errors it found, the response envelope that reports them, and the paired HTTP status. HTTP routing, storage, tokens, and spam defense stay with your application. [Server Obligations](../specs/submission-protocol.md#server-obligations) lists what a conforming endpoint does with the answer.

```php
use WebSanity\FormSanity\Form;

$result = Form::parse($html)->validate($payload);
```

## Install

Install the package with Composer:

```bash
composer require websanity/formsanity
```

The package needs PHP 8.4 or later, with `ext-dom` and `ext-mbstring`. It reads markup with `Dom\HTMLDocument`, the standards-compliant HTML parser of PHP 8.4. It speaks protocol version 2, which [Protocol Version](../specs/submission-protocol.md#protocol-version) defines, and it writes `formsanity: 2` into every envelope.

## Parse and Validate

Two calls do the work. `Form::parse(string $html): Form` reads the markup and builds the rule model of the form. `$form->validate(array $payload, array $files = []): Result` judges one submission against that model.

The `validate()` call takes three more optional arguments: a uniqueness callable, an unknown-fields position, and a list of extra payload keys. The sections that follow cover each one.

Parse once and reuse the form. The parse walks the document and compiles every expression. A validate call repeats none of that work.

The `$html` string holds the markup you rendered for that form. The parse finds the first element with `data-fs-form` inside it, so a whole page is a valid input. [Re-Validation](../specs/submission-protocol.md#re-validation) gives the reason the markup has to be the markup you rendered.

The `$payload` array is the decoded JSON body, or `$_POST` when the body is multipart. The `$files` array is `$_FILES`, in either shape PHP gives it.

```php
use WebSanity\FormSanity\Form;

$form = Form::parse($html);
$result = $form->validate($payload, $_FILES);
```

## The Two Encodings

The markup selects the encoding. A form with no `input[type="file"]` submits a JSON object. A form with one or more file inputs submits `multipart/form-data`, even when the person selected no file. [Encoding](../specs/submission-protocol.md#encoding) governs the choice, and your endpoint reads the body the way the content type says.

A multipart body names each part of an array-valued field `name[]`. The package strips exactly one trailing `[]` from every payload key and every `$_FILES` key, so you pass `$_POST` and `$_FILES` as they arrive. A JSON body uses the authored name for every key. [Field Names and Values](../specs/submission-protocol.md#field-names-and-values) defines both forms.

An absent key, an empty string, and an empty array are one answer: no answer. The package reads all three alike, so the two encodings reach the rules the same way. An expression that names a file field reads it as the names of its files, joined with commas.

A file field has no JSON form. When a JSON body carries a key for a file field, `validate()` answers an invalid result with the extension code `x-malformed-body`. It raises no exception, because a body the protocol does not describe is a failed submission. The same answer covers a body that carries both `name` and `name[]` for one field, and an upload entry that PHP could not have produced: one without an error code, or with a size that is negative or not a number.

```php
$type = $_SERVER['CONTENT_TYPE'] ?? '';

if (str_starts_with($type, 'application/json')) {
	$payload = json_decode(file_get_contents('php://input'), true) ?? [];
	$result = $form->validate($payload);
} else {
	$result = $form->validate($_POST, $_FILES);
}
```

## The Result

A `Result` holds the errors of one submission and reports them five ways. [Response Envelope](../specs/submission-protocol.md#response-envelope) governs the shapes it builds.

| Method                                                     | Answer                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `isValid(): bool`                                          | `true` when the submission produced no error                            |
| `errors(): array`                                          | The error objects, each with `field`, `code`, and `message`             |
| `withError(?string $field, string $code, string $message)` | A new result with a failure of your own added, such as an `x-` code     |
| `envelope(?string $message, ?string $redirect): array`     | The accepted or invalid envelope, as an array ready for `json_encode()` |
| `httpStatus(): int`                                        | `200` for an accepted result, `422` for an invalid one                  |

The `field` of an error object holds the authored name of the field, or `null` for an error about the submission as a whole. Errors arrive in field document order, with the form-level ones last.

The two arguments of `envelope()` belong to the accepted case. `$message` is the text of your thank-you line, and `$redirect` is a URL for the client to follow. An invalid result drops both and reports the error objects.

The package judges a submission and hands back no cleaned payload, so filter the payload yourself before you store it. `$form->fieldNames(): array` gives the authored field names as a list of strings in document order.

Here is a complete endpoint:

```php
<?php

require __DIR__ . '/vendor/autoload.php';

use WebSanity\FormSanity\Form;

$form = Form::parse(render_signup_form());
$result = $form->validate($_POST, $_FILES);

if ($result->isValid()) {
	store_submission(array_intersect_key($_POST, array_flip($form->fieldNames())), $_FILES);
}

header('Content-Type: application/json');
http_response_code($result->httpStatus());
echo json_encode($result->envelope('Thank you. We got your message.'));
```

PHP fills `$_POST` with the authored names, so the filter above finds them. A host that parses a multipart body itself maps each `name[]` key back to `name` before it filters.

## Unknown Fields and Extras

A payload can carry keys the markup does not define: a hook-injected token, a stale key from a cached page, or a probe. [Unknown Fields](../specs/submission-protocol.md#unknown-fields) gives a server two positions, and the package implements both as the `Unknown` enum.

`Unknown::Ignore` is the default. The package drops every key that is neither a field of the form nor a listed extra. `Unknown::Reject` answers an invalid result instead. No matter how many keys drifted, the reject position adds one form-level error, with `field: null` and the extension code `x-unknown-field`. The message of that error names no key, so a probe learns nothing from the answer.

The `$extras` argument lists the payload keys your application injects: a CSRF token, a captcha response, a payment token. Those keys are known without being authored, so the reject position accepts them. The package never judges an extra, and never stores one.

```php
use WebSanity\FormSanity\Unknown;

$result = $form->validate(
	$_POST,
	$_FILES,
	unknown: Unknown::Reject,
	extras: ['csrf_token', 'captcha_response'],
);
```

## Uniqueness

A field with `data-fs-unique="url"` asks a server whether its value is still free. The datastore is yours, so the package takes the answer as a callable of the shape `fn(string $field, string $value): bool`. The callable returns `true` when the value is free. [Uniqueness Sub-Protocol](../specs/submission-protocol.md#uniqueness-sub-protocol) governs the exchange.

The package asks the callable last, and asks it only about a field that survived every other check with a non-empty value. A taken value becomes an error with the code `unique` on that field. Without a callable, the package runs no uniqueness check at all, and the submission is then unguarded against duplicates.

The interactive check endpoint of the attribute is your route. `Envelope::unique(bool $unique): array` builds its answer.

```php
use WebSanity\FormSanity\Envelope;

$unique = static fn (string $field, string $value): bool => !$db->taken($field, $value);
$result = $form->validate($_POST, $_FILES, $unique);

// The interactive check endpoint, at the URL of data-fs-unique.
$body = json_decode(file_get_contents('php://input'), true) ?? [];

header('Content-Type: application/json');
echo json_encode(Envelope::unique($unique($body['field'] ?? '', $body['value'] ?? '')));
```

## Authoring Errors

`Form::parse()` raises `AuthoringError` when the markup asks for something the vocabulary does not define. It is a `LogicException`, because the fault is in the page, not in the submission. These are the causes:

- The document holds no element with `data-fs-form`.
- A `data-fs-type` names a type outside the catalog of [Field Types](../specs/vocabulary.md#field-types).
- A file size is not a number and a unit of `b`, `kb`, `mb`, or `gb`.
- A `pattern` attribute does not compile as a regular expression.
- An expression breaks the [Expression Grammar](../specs/vocabulary.md#expression-grammar), with an unknown function, an unbalanced parenthesis, or a missing operand.

A pattern that compiles but exceeds the backtrack limit of PCRE at validation time reads as no match, so the field reports `pattern`. A pattern that heavy is an authoring problem to fix in the page.

Parse the form at render time, and cache the parsed form for the submission. The authoring error then reaches you while you build the page, and a person never meets it as a broken submission.

```php
use WebSanity\FormSanity\AuthoringError;
use WebSanity\FormSanity\Form;

try {
	$form = Form::parse($html);
} catch (AuthoringError $error) {
	// The markup is wrong. Report it to the author, not to the person filling in the form.
	log_authoring_error($error->getMessage());
}
```

## Failure Paths

A client reads a response that is not a FormSanity envelope as a protocol error, and shows a generic failure line. An endpoint that answers HTML when it breaks leaves the protocol at the moment it most needs to speak. [Protocol Errors](../specs/submission-protocol.md#protocol-errors) lists every condition a client counts as one.

Answer JSON on every path a submission can take. This includes the unhandled-exception page of your framework and the timeout page of your proxy. `Envelope::error(?string $message): array` builds the envelope for those paths, and the HTTP status of your choice travels with it.

```php
use WebSanity\FormSanity\Envelope;

set_exception_handler(static function (\Throwable $error): void {
	error_log((string) $error);

	http_response_code(500);
	header('Content-Type: application/json');
	echo json_encode(Envelope::error('The submission could not be saved. Please try again.'));
});
```

## What the Package Leaves to You

The package never reads a superglobal, sets a header, touches storage, or reads the bytes of a file. Your application owns all of it. [Security and Exclusions](../specs/submission-protocol.md#security-and-exclusions) puts the same list outside the protocol.

- **HTTP.** Routing, reading the request body, headers, the status code, and CORS.
- **Storage.** Where a submission goes, what it is called there, how long it lives, and what it notifies.
- **Tokens.** CSRF tokens, captcha responses, and payment tokens arrive as payload keys. You name them as extras and judge them yourself.
- **Spam defense and rate limits.** Reject on any grounds you like, as a form-level error or an `error` envelope.
- **Content sniffing.** The file rules judge the name, the reported type, and the size of an upload. Reading the bytes of an upload is yours.
