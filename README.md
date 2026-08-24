# FormSanity

FormSanity is a declarative form library: validation, cross-field rules, and conditional display are all written into HTML as `data-fs-*` attributes and native constraint attributes, and the engine reads that markup and brings it to life. There is no imperative form-wiring code to write. The library is dependency-free ES modules.

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

## Documentation

Writing forms? Start with [the guide](docs/guide.md) — a ten-chapter tour of the vocabulary in plain language — and keep [the reference](docs/reference.md) at hand for attribute-by-attribute lookup.

Building a backend or another implementation? `specs/vocabulary.md` and `specs/submission-protocol.md` are the actual product, not just documentation of this library. Together they're the portable contract — the markup vocabulary and the wire format — that any backend can implement without reading this library's source. Where the library and a spec disagree, the spec is correct and the library has a bug.

## Instrumentation

`instrumentation/` holds one page per vocabulary area (required fields, types, limits, comparisons, relevance, operations, choice groups, submission), each exercising that area's attributes against a live form. Run `npm run serve` and open `http://localhost:8347/instrumentation/`.

## Testing

```
npm test          # unit tests
npm run test:e2e  # Playwright end-to-end tests
npm run lint      # ESLint
```

## Distribution

There is no build step: the ES modules and the stylesheet under `lib/` load directly with `<link>` and `<script type="module">`, so copying `lib/` into a project is a complete installation. Releases are versioned by date-based git tag (`2026.8.24`), not by a published package.

Each GitHub Release additionally carries the easiest thing to include in another project: `formsanity.js`, the library bundled into a single ES module file, and `formsanity.css` — two files, two lines of HTML. Both open with a `/* FormSanity <version> */` banner comment identifying their release.

`npm run release` cuts a release: it stamps today's date as the version, runs the checks, builds the two artifacts into `dist/` and smoke-checks them in a real browser, then tags, pushes, and attaches them to a GitHub Release. `npm run dist` runs just the build and smoke check. `dist/` is a build product and stays out of git.

## Browser Support

The floor is Baseline Widely Available. Container size queries, subgrid, native CSS nesting, and `@layer` are all in bounds; container style queries are not.

## Theming

All visual styling lives in `@layer formsanity` in `lib/formsanity.css`, so any site stylesheet outranks it without needing `!important`. The custom properties on `.fs-form` are the supported theming surface — override them to restyle colors, spacing, and borders without touching the layer itself.
