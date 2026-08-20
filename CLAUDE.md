# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FormSanity v2 — a rewrite of WebSanity's declarative form library as dependency-free ES modules. Form logic (validation, cross-field rules, conditional display) is defined entirely in HTML data attributes; the library reads the markup and brings it to life. The project's product is three artifacts: the library, a written vocabulary spec, and a written submission protocol spec.

**Required reading before any design or implementation work:** `docs/2026-08-20-formsanity-v2-charter.md` — the approved requirements, decomposition, constraints, and open questions.

## Current Status

Design phase. The charter is approved; the sub-project 1 design dialogue (vocabulary pruning, distribution targets, envelope v2, test strategy) has not happened yet. No code or tooling exists — scaffolding decisions (module layout, build, test runner) belong to that design, so do not pre-commit to structure.

## Ecosystem Map

| Repo / Location                                     | Role                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `~/dev/websanity-meta/formsanity/` (this repo)      | FormSanity v2 library + vocabulary and protocol specs                       |
| `~/dev/websanity-meta/formsanity-client/`           | Legacy v1 — frozen reference implementation and vocabulary authority        |
| `formsanity-client/public/mock/`                    | ~28 real-world v1 forms — compatibility test fixtures for v2                |
| `formsanity-client/public/instrumentation/`         | Per-feature vocabulary exercise pages                                       |
| Future Concrete package (`concrete-sites/`, TBD)    | Server-side consumer: block type, markup parser, Express storage (sub-project 2) |

## Ground Rules

- **Concrete-independence.** No Concrete-aware code in this library, ever. Concrete's needs travel through generic surface only: the form `action` URL, a generic extra-hidden-fields mechanism, and the submission envelope. The specs are the contract; consumers implement them.
- **Do not modify `formsanity-client`.** Live v1 sites (pfems.com, meteoritical.org) depend on it. Read it freely as the vocabulary authority.
- **Specs are the product.** Non-Concrete backends must be able to implement the vocabulary and protocol specs without reading this library's source.
