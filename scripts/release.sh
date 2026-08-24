#!/bin/bash
# Cuts a release: stamps today's date as the version, runs the checks, builds dist/, tags, pushes, and attaches the artifacts to a GitHub Release.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
	echo "working tree not clean — commit or stash first" >&2
	exit 1
fi

today=$(node -p "const d = new Date(); [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('.')")
version=$(node -p "require('./package.json').version")
if [ "$version" != "$today" ]; then
	npm pkg set "version=$today"
	npm install --package-lock-only --no-audit --no-fund
	git commit -qam "chore: version $today"
	version=$today
fi

if git rev-parse -q --verify "refs/tags/$version" > /dev/null; then
	echo "tag $version already exists" >&2
	exit 1
fi

npm run lint
npm test
npm run test:e2e
npm run dist

git tag "$version"
git push origin HEAD "$version"
gh release create "$version" dist/formsanity.js dist/formsanity.css --title "$version" --generate-notes
