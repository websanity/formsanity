# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FormSanity — WebSanity's declarative form library, as dependency-free ES modules. Form logic (validation, cross-field rules, conditional display) is defined entirely in HTML data attributes; the library reads the markup and brings it to life. The client library is what people use. Two written specs, the vocabulary and the submission protocol, are the contract that makes it portable and its submissions trustworthy. A server implementation is the other signatory of that contract. The original charter, design, and implementation plan are dated records retrievable from git history (deleted 2026-08-24).

## Current Status

Implemented; see `README.md`.

## Ecosystem Map

| Repo / Location                                  | Role                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `~/dev/websanity-meta/formsanity/` (this repo)   | FormSanity library + vocabulary and protocol specs              |
| `php/` (this repo)                               | PHP implementation of the specs: server parser + envelope layer |
| Future Concrete package (`concrete-sites/`, TBD) | Adapter: block type + Express storage, built on the PHP package |

## Documentation

Six layers, from normative to demonstrative. When they disagree, the layer above wins.

| Document                        | Role                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `specs/*.md`                    | Normative. RFC-2119 language. The only place edge cases and conformance rules are stated                         |
| `docs/implementing-a-server.md` | Implementer orientation: build order, vector consumption, links into the governing spec sections                 |
| `docs/php.md`                   | Host page for the PHP implementation: how to parse, validate, and answer; links into the governing spec sections |
| `docs/reference.md`             | Author lookup: one entry per attribute — role, host element, values, example, spec link                          |
| `docs/guide.md`                 | Author narrative, ordered by the authoring journey; each chapter links to its demo page                          |
| `demos/*.html`                  | Live demonstration of each vocabulary area; also the e2e fixtures                                                |

- **The guide demonstrates, the spec governs.** The guide and reference never restate MUST-level edge cases — they show the common path in common language and link to the governing spec section. No RFC-2119 keywords outside `specs/`.
- **A vocabulary or behavior change touches every layer.** Spec section first, then the reference entry, the guide chapter, and the demo page. A change is not done while any layer still describes the old behavior.

## Ground Rules

- **Concrete-independence.** No Concrete-aware code in this library, ever. Concrete's needs travel through generic surface only: the form `action` URL, a generic extra-hidden-fields mechanism, and the submission envelope. The specs are the contract; consumers implement them.
- **The specs stand alone.** A backend must be able to implement the vocabulary and protocol specs without reading this library's source. When the library and a spec disagree, the spec wins and the library has the bug.

## PHP Implementation

`php/` holds a PHP implementation of the specs: a conforming **server parser** plus the envelope layer of the submission protocol. It gives any PHP backend spec-conforming validation of FormSanity submissions. It is a framework-agnostic Composer package (`websanity/formsanity`, PHP 8.4+), with `composer.json` and `phpunit.xml` at the repo root and PSR-4 from `php/src/`. It is an _implementation_ of the specs. It is never called an adapter (the CMS glue above it) and never a port (it is written from the specs, not translated from the JS source).

**Status.** Implemented; see `docs/php.md`.

### Ground Rules

- **Implement from the specs, never from the JS source.** The PHP implementation exists partly to prove the specs stand alone. Do not read `lib/` to resolve an ambiguity. An ambiguity that forces you there is a spec bug; fix the spec first, then implement.
- **Framework-agnostic, always.** No CMS code, no HTTP layer, no storage, no session or token logic. The package takes markup + payload and returns verdicts and envelope arrays. Uniqueness is an injected callable (`fn(string $field, string $value): bool`); the datastore is the host's business.
- **The vectors are law.** `vectors/` is the normative conformance corpus, shared with the client. An implementation that disagrees with a vector is wrong. A spec change that adds a vector adds it for both implementations in the same commit.
- **A spec change touches the PHP implementation too.** The documentation layering rule lists the layers a vocabulary or behavior change touches. `php/` is one more: a change is not done while the server parser still implements the old rule.

### Scope

In scope: payload normalization (both encodings, absent ≡ empty), the native register re-derived from attributes, the `data-fs-*` rules, the type validators and three-state verdicts, the expression grammar, relevance evaluation per control, conditional requiredness, `$_FILES`-shape file-rule validation, error objects and envelope construction with the closed code registry.

Out of scope: behaviors and presentation (a server parser ignores them), canonicalization rewriting (a client-engine duty; the server validates what arrives), and everything listed under the protocol's Security and Exclusions.

### Build Order

1. Expression engine + type validators, proven against the vectors (no HTML, no HTTP).
2. Envelope construction: the three envelopes, error objects, the code registry.
3. Markup parsing with `Dom\HTMLDocument` (PHP 8.4) → serializable per-field rule model.
4. Relevance evaluation per control (members, options, regions), conditional requiredness, payload normalization, file rules, the uniqueness callable.

`docs/implementing-a-server.md` is the orientation page this work follows. Watch for the port traps it links: emptiness belongs to `required` alone, `step` measures from its base, `pattern` is anchored whole-string (PCRE `u` flag, wrapped `^(?:…)$`, uncompilable = authoring error), lengths count UTF-16 code units (not bytes, not code points), values validate as raw strings.

### Conventions

- Tabs for indentation, including in PHP (overrides PER/PSR-12 spaces)
- PHPUnit for tests (`composer test`, which the release script also runs); vector files wired in as data providers
- Namespace `WebSanity\FormSanity\`, PSR-4 from `php/src/`

### Open Decisions

- Public API: `Form::parse()` then `validate()`, returning a `Result`. Decided 2026-09-09.
- File input: `$_FILES` as it comes, both shapes. Decided 2026-09-09.
- The rule model is internal, with no serialization API. Decided 2026-09-09.
