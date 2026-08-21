# FormSanity v2

FormSanity is a declarative form library: validation, cross-field rules, and conditional display are all written into HTML as `data-fs-*` attributes and native constraint attributes, and the engine reads that markup and brings it to life. There is no imperative form-wiring code to write. v2 is a dependency-free rewrite as ES modules, replacing the legacy jQuery library while keeping its data-attribute vocabulary.

## Quick Start

Load the stylesheet and the module, then call `init()`:

```html
<link rel="stylesheet" href="lib/formsanity.css">
<script type="module">
	import { init } from './lib/formsanity.js';
	init();
</script>
```

`init()` finds every `form[data-fs-form]` in the document and activates it. A minimal form, in the library's default document grammar — a `fieldset`/`legend` section holding a `ul` of `li` rows:

```html
<form data-fs-form action="/api/submit" method="post">
	<fieldset>
		<legend>Contact</legend>
		<ul>
			<li>
				<label for="name">Name</label>
				<input id="name" name="name" type="text" required>
			</li>
			<li>
				<label for="email">Email</label>
				<input id="email" name="email" type="text" data-fs-type="email" required>
			</li>
		</ul>
	</fieldset>
	<button type="submit">Submit</button>
</form>
```

That's the whole grammar for this example: `data-fs-form` marks the form, `fieldset`/`ul`/`li` give it rows the engine can find without any FormSanity-specific wrapper elements, and `required`/`data-fs-type` describe the rules. The engine handles validation, error rendering, and submission gating on its own. `action="/api/submit"` matches the dev server's route — point it at your own endpoint.

## Specs

`specs/vocabulary.md` and `specs/submission-protocol.md` are the actual product, not just documentation of this library. Together they're the portable contract — the markup vocabulary and the wire format — that any backend can implement without reading this library's source. Where the library and a spec disagree, the spec is correct and the library has a bug.

## Instrumentation

`instrumentation/` holds one page per vocabulary area (required fields, types, limits, comparisons, relevance, operations, choice groups, submission), each exercising that area's attributes against a live form. Run `npm run serve` and open `http://localhost:8347/instrumentation/`.

## Ported Forms

`forms/` holds four real forms ported from the v1 mock fixtures, at production scale rather than instrumentation scale. `forms/PORTING.md` records the substitution table and the judgment calls made while porting them — the seed of the eventual v1-to-v2 site migration playbook.

## Testing

```
npm test          # unit tests
npm run test:e2e  # Playwright end-to-end tests
npm run lint      # ESLint
```

## Distribution

There is no build step and no `dist/`. The ES modules and the stylesheet under `lib/` are the distributable artifact, loaded directly with `<link>` and `<script type="module">`. Releases are versioned by git tag, not by a published package.

## Browser Support

The floor is Baseline Widely Available. Container size queries, subgrid, native CSS nesting, and `@layer` are all in bounds; container style queries are not.

## Theming

All visual styling lives in `@layer formsanity` in `lib/formsanity.css`, so any site stylesheet outranks it without needing `!important`. The 21 custom properties on `.fs-form` are the supported theming surface — override them to restyle colors, spacing, and borders without touching the layer itself.
