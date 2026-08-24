#!/bin/bash
# Builds the release artifacts into dist/ and smoke-checks them in a real browser.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")

rm -rf dist
mkdir dist
npx esbuild lib/formsanity.js --bundle --format=esm --banner:js="/* FormSanity $version */" --outfile=dist/formsanity.js --log-level=warning
{ printf '/* FormSanity %s */\n' "$version"; cat lib/formsanity.css; } > dist/formsanity.css
node scripts/check-dist.js
echo "dist/ built and checked: FormSanity $version"
