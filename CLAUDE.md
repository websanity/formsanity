# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FormSanity — WebSanity's declarative form library, as dependency-free ES modules. Form logic (validation, cross-field rules, conditional display) is defined entirely in HTML data attributes; the library reads the markup and brings it to life. The project's product is three artifacts: the library, a written vocabulary spec, and a written submission protocol spec. The original charter, design, and implementation plan are dated records retrievable from git history (deleted 2026-08-24).

## Current Status

Implemented; see `README.md`.

## Ecosystem Map

| Repo / Location                                  | Role                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `~/dev/websanity-meta/formsanity/` (this repo)   | FormSanity library + vocabulary and protocol specs               |
| Future Concrete package (`concrete-sites/`, TBD) | Server-side consumer: block type, markup parser, Express storage |

## Documentation

Four layers, from normative to demonstrative. When they disagree, the layer above wins.

| Document                 | Role                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `specs/*.md`             | Normative. RFC-2119 language. The only place edge cases and conformance rules are stated           |
| `docs/reference.md`      | Author lookup: one entry per attribute — role, host element, values, example, spec link            |
| `docs/guide.md`          | Author narrative, ordered by the authoring journey; each chapter links to its demo page            |
| `demos/*.html`           | Live demonstration of each vocabulary area; also the e2e fixtures                                  |

- **The guide demonstrates, the spec governs.** The guide and reference never restate MUST-level edge cases — they show the common path in common language and link to the governing spec section. No RFC-2119 keywords outside `specs/`.
- **A vocabulary or behavior change touches every layer.** Spec section first, then the reference entry, the guide chapter, and the demo page. A change is not done while any layer still describes the old behavior.

## Ground Rules

- **Concrete-independence.** No Concrete-aware code in this library, ever. Concrete's needs travel through generic surface only: the form `action` URL, a generic extra-hidden-fields mechanism, and the submission envelope. The specs are the contract; consumers implement them.
- **Specs are the product.** Non-Concrete backends must be able to implement the vocabulary and protocol specs without reading this library's source.
