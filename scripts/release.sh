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

# One release a day is the rule, so a second run on one day stops here. With --same-day, the release takes a fourth component, YYYY.M.D.N. The git tag carries it and package.json keeps the date, because npm rejects a four-part version and Composer accepts one.
tag=$version
if git rev-parse -q --verify "refs/tags/$tag" > /dev/null; then
	if [ "${1:-}" != "--same-day" ]; then
		echo "tag $tag already exists — pass --same-day to release as $tag.N" >&2
		exit 1
	fi
	n=1
	while git rev-parse -q --verify "refs/tags/$version.$n" > /dev/null; do n=$((n + 1)); done
	tag="$version.$n"
fi

npm run lint
npm test
npm run test:e2e
composer test
FS_VERSION="$tag" npm run dist

git tag "$tag"
git push origin HEAD "$tag"
gh release create "$tag" dist/formsanity.js dist/formsanity.css --title "$tag" --generate-notes
