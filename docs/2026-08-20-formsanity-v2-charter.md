# FormSanity v2 Charter

**Date:** 2026-08-20. **Status:** approved requirements; design work not yet started. This document is the handoff from the initial brainstorming session — a fresh session should be able to read it and begin the sub-project 1 design dialogue cold.

## Project Statement

FormSanity is WebSanity's declarative form library: all form logic — validation, cross-field rules, conditional display — is defined in HTML data attributes, and a client engine reads the markup and brings it to life. The v1 library (`~/dev/websanity-meta/formsanity-client`) is 2020-era jQuery; the server-side system that once parsed the same markup for server-side validation is gone. This project rewrites the client as a modern dependency-free library and builds a new server-side consumer for Concrete CMS, with the markup vocabulary and submission protocol formalized as written specs that any backend can implement.

## Background: the v1 Library

The legacy repo at `~/dev/websanity-meta/formsanity-client` remains untouched as the reference implementation and vocabulary authority. What it does:

- **Validation vocabulary** — `data-required`, `data-type` with ~30 built-in types (email, us-phone, zip, ssn, ipv4/ipv6, us-dollar, time, duration, credit-card, stripe-credit-card, …), `data-pattern`, min/max length and value, password-complexity counts (`data-min-length-digit` etc.), file constraints (`data-file-extension`, `data-max-file-size`).
- **Cross-field rules** — `data-equal-to-field`, `data-not-equal-to-field`, `data-greater-than-field` / `data-less-than-field` (date-aware), `data-required-group` (at_least_one / all / none_or_all), `data-min-selected` / `data-max-selected`, `data-unique` (server-checked, with rate-limit responses).
- **Conditional logic** — `data-display` and `data-enable` take expressions against other fields (e.g. `data-display="(field-two != 'Torch Red' && field-two != '')"`), plus `data-copy-value-to` and `data-all-are-valid="enable"` on the submit button.
- **Submission** — fields gathered into JSON or `FormData` (files), POSTed to the form's `action` (or current URL). Third-party tokens injected as fields: `grecaptchaToken`, `stripeToken`.
- **Response envelope** — `{ok, result: {success, message, errors[]}}`. Success with a URL in `message` triggers a redirect. Server-side validation failure is HTTP 200 with `success: false` and the literal string `Validation Error` in `message` (a v1 quirk; v2 should replace this magic string). Processing failures are 400/500 with `ok: false`.

The `public/mock/` directory holds ~28 real-world forms (membership joins, renewals, donations, profile edits) — these are the compatibility test fixtures for v2. The `public/instrumentation/` pages exercise individual vocabulary features.

## Decomposition

Three sub-projects, each with its own spec → plan → implementation cycle:

1. **FormSanity v2 (this repo)** — rewrite the client as dependency-free ES modules (jQuery and Grunt gone), vocabulary-compatible with v1 modulo deliberate pruning. The product is three artifacts: the library, a written **vocabulary spec**, and a written **submission protocol spec**. The specs are the portable contract every backend implements against.
2. **Concrete CMS package** — a shared package (own repo under `~/dev/websanity/concrete/concrete-sites/`, underscore-prefixed per WebSanity convention, deployed fleet-wide like other shared packages). Contents: a dedicated Formsanity Form block type; a registration step (CLI command) that parses a form's markup and derives both the Express entity + attribute keys and a stored runtime validation ruleset; a submission endpoint (CSRF, server-side rule evaluation including conditional-visibility logic, captcha, antispam) that stores submissions as Express entries — results in Dashboard → Reports → Forms with core notifications and export for free. The block type is one consumer of the package's rendering/processing services, not the only one — a dashboard single page must be able to render and process a FormSanity form through the same machinery.
3. **Legacy site migration (parked)** — pfems.com and meteoritical.org use v1 for membership signup and management and stay on v1 for now. Migrating them to v2 waits until v2 is proven inside Concrete.

**Order: client first.** The Concrete package's PHP parser must target the final v2 vocabulary. Writing it against the v1 vocabulary and then pruning during the rewrite would mean writing the parser twice.

## Approved Decisions

- Forms are **developer-authored markup**; the markup is the **single source of truth** for all rules. The Express Form builder UI is not involved.
- The server derives its rules by **parsing the markup at registration time** (a CLI command or on-save hook), not at submit time and not from a separate hand-maintained definition.
- Submissions land as **Express entries** in Concrete.
- The client gets a **full modernization**: dependency-free ES modules, vocabulary kept compatible.
- Delivery on the Concrete side is a **dedicated block type** in a shared package.

## Constraints

- **Concrete-independence.** The library must contain no Concrete-aware code. Everything Concrete needs rides through generic surface: the endpoint URL (the form `action`), a generic mechanism for extra hidden fields (how Concrete's CSRF token travels — the library never knows what a CSRF token is), and the submission envelope. The Concrete package is purely a consumer of the two specs; nothing flows the other direction.
- **Non-Express consumers are first-class.** The specs must stand alone so non-Concrete backends (pfems/meteoritical-style membership servers, future uses) can implement them independently.
- **Do not modify `formsanity-client`.** It is the frozen reference; v1 sites depend on it.

## Open Questions for the Sub-Project 1 Design

- **Vocabulary pruning** — which v1 features earn a place in v2: Stripe token injection, the bundled pikaday date picker and custom picker, the markers/layout machinery (`data-marker`, multi-column breakpoints)?
- **Distribution targets** — ES module only, or also a plain `<script>` bundle? Browser-support floor? Is `dist/` committed (v1 committed it) or built per-consumer?
- **Envelope v2** — structured per-field errors (v1's `errors[]` is flat prose strings; keyed errors would let the client highlight offending fields on server-side rejection), and retiring the `Validation Error` magic string. Versioning strategy for the protocol.
- **Test strategy** — how v2 consumes the v1 mock forms as compatibility fixtures (copied, submodule, or read in place), and what the harness looks like without a legacy server.
