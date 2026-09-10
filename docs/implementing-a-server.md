# Implementing a Server

This page is the starting point when you build a FormSanity backend: a submission endpoint, a server-side validator, or both. It links into the two specs. The specs are the full definition. Where this page and a spec disagree, the spec is correct.

## The Contract

Two documents define everything a server honors.

| Document                                                          | Owns                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`specs/vocabulary.md`](../specs/vocabulary.md)                   | The markup: attributes, rules, verdicts, error codes, relevance, the expression grammar |
| [`specs/submission-protocol.md`](../specs/submission-protocol.md) | The wire: the request, the response envelope, server obligations, the uniqueness check  |

A server implements the **server parser** conformance class: the native constraint attributes, the `data-fs-*` rules, and relevance. The behavior and presentation attributes have no effect on validation, and a server parser ignores them. [Scope and Conformance](../specs/vocabulary.md#scope-and-conformance) defines the class. [Server Obligations](../specs/submission-protocol.md#server-obligations) lists what a conforming endpoint does with it.

The implementations in this repository are references, and the specs are the contract. `lib/` is one client engine. `test/server.js` shows the envelope shapes in dependency-free Node, with no validation. You can implement both specs without reading either one.

## The Vectors

`vectors/validators.json` and `vectors/expressions.json` are the shared conformance corpus. Both are normative: an implementation that disagrees with a vector is wrong. `validators.json` pins the three-state verdict of every `data-fs-type`. `expressions.json` pins the expression grammar and its semantics. The [Conformance Suite](../specs/vocabulary.md#conformance-suite) section documents both file shapes.

Wire the vectors into your test framework as data-driven cases. Consume them at a pinned release tag, not as a copy that can drift. A port that passes both files validates the way the reference client validates.

## Build Order

Each stage is testable on its own before the next begins.

1. **Expression engine and type validators.** Build them against the vectors, with no HTML parsing and no HTTP. This stage is the largest share of the semantics and the easiest to test.
2. **Envelope shapes.** Implement the three response envelopes and the `formsanity` version property. Answer JSON on every path a submission can take. This includes the error page of your framework. `test/server.js` shows the shapes. The [Response Envelope](../specs/submission-protocol.md#response-envelope) section governs them.
3. **Markup parsing.** Read the form markup with a real HTML parser. Derive the rules of each field: the native register and the `data-fs-*` rules. Validate against [the markup you rendered for that form](../specs/submission-protocol.md#re-validation).
4. **Relevance and conditional requiredness, then the rest.** Evaluate relevance per control against the submitted payload, with the engine from stage 1: the control's own `data-fs-relevant`, that of each `option`, and that of every containing region. Evaluate each `data-fs-required` expression the same way, and enforce emptiness where it is true. Then add storage, your [unknown-fields position](../specs/submission-protocol.md#unknown-fields), and the [uniqueness check](../specs/submission-protocol.md#uniqueness-sub-protocol).

The pages in `demos/` submit real payloads. Thus they also work as end-to-end fixtures for your endpoint.

## Common Errors in Ports

Each item links to the section that governs it.

- [Re-Deriving Native Constraints Without a Browser](../specs/vocabulary.md#re-deriving-native-constraints-without-a-browser) — Emptiness belongs to `required` alone. `step` measures from its base, not from zero. `pattern` is anchored and matches the whole string. Lengths count UTF-16 code units.
- [Field Names and Values](../specs/submission-protocol.md#field-names-and-values) — Every value travels as a raw string. A checkbox or radio field is always an array. In a multipart body the parts of an array-valued field are named `name[]`. Map the suffix back to the authored name. Validate the string that the client saw. Then parse.
- [What Is Omitted](../specs/submission-protocol.md#what-is-omitted) — An absent key, an empty array, and an empty string all say the same thing: no answer.
- [The Server Obligation](../specs/vocabulary.md#the-server-obligation) — A non-empty value for an irrelevant field is a validation failure, with the code `relevance`. An empty value for one is no answer.
- [Member Relevance](../specs/vocabulary.md#member-relevance) — A submitted value that names an irrelevant member or option is a `relevance` failure. A group with some conditional members reads its relevant members only when an expression names it.
- [Conditional Requiredness](../specs/vocabulary.md#conditional-requiredness) — A true `data-fs-required` is enforced exactly as native `required`, with the code `required`. An unanswered reference reads as empty, so the expression's polarity is the author's, not yours.
- [Canonicalization](../specs/vocabulary.md#canonicalization) — A conforming client submits the canonical form of the rewriting types. The server still validates the value that arrives.
- [Protocol Errors](../specs/submission-protocol.md#protocol-errors) — An endpoint that answers HTML when it breaks leaves the protocol at the moment it most needs to say something.
