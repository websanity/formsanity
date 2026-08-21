# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FormSanity v2 — a rewrite of WebSanity's declarative form library as dependency-free ES modules. Form logic (validation, cross-field rules, conditional display) is defined entirely in HTML data attributes; the library reads the markup and brings it to life. The project's product is three artifacts: the library, a written vocabulary spec, and a written submission protocol spec.

**Required reading before any design or implementation work:** `docs/2026-08-20-formsanity-v2-design.md` — the approved design. The earlier `docs/2026-08-20-formsanity-v2-charter.md` holds the original requirements and constraints; where the two disagree, the design wins.

## Current Status

Implemented; see `README.md`.

## Ecosystem Map

| Repo / Location                                     | Role                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `~/dev/websanity-meta/formsanity/` (this repo)      | FormSanity v2 library + vocabulary and protocol specs                       |
| `~/dev/websanity-meta/formsanity-client/`           | Legacy v1 — frozen reference implementation and vocabulary authority        |
| `formsanity-client/public/mock/`                    | ~28 real-world v1 forms — compatibility test fixtures for v2                |
| `formsanity-client/public/instrumentation/`         | Per-feature vocabulary exercise pages                                       |
| Future Concrete package (`concrete-sites/`, TBD)    | Server-side consumer: block type, markup parser, Express storage             |

## Ground Rules

- **Concrete-independence.** No Concrete-aware code in this library, ever. Concrete's needs travel through generic surface only: the form `action` URL, a generic extra-hidden-fields mechanism, and the submission envelope. The specs are the contract; consumers implement them.
- **Do not modify `formsanity-client`.** Live v1 sites (pfems.com, meteoritical.org) depend on it. Read it freely as the vocabulary authority.
- **Specs are the product.** Non-Concrete backends must be able to implement the vocabulary and protocol specs without reading this library's source.
