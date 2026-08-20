# FormSanity v2

WebSanity's declarative form library, second generation. Form logic — validation, cross-field rules, conditional display — is defined entirely in HTML data attributes; FormSanity reads the markup and brings it to life. v2 is a dependency-free ES-module rewrite of the [legacy jQuery library](../formsanity-client/), keeping its data-attribute vocabulary and formalizing two written specs — the markup vocabulary and the submission protocol — so any backend can process FormSanity forms.

## Status

Design phase. See `docs/2026-08-20-formsanity-v2-charter.md` for the approved requirements, project decomposition, and open design questions. No code yet.

## Relationship to v1

The legacy library lives at `~/dev/websanity-meta/formsanity-client` and remains frozen as the reference implementation — live sites depend on it. Its mock forms serve as v2's compatibility fixtures.
