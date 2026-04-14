#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
ARTIFACT="build/zotero-translate.xpi"
VERSIONED_ARTIFACT="zotero-translate-plugin-${VERSION}.xpi"

npm run build

if [ ! -f "$ARTIFACT" ]; then
  echo "Build finished but $ARTIFACT was not generated" >&2
  exit 1
fi

cp "$ARTIFACT" "$VERSIONED_ARTIFACT"
echo "Built: $VERSIONED_ARTIFACT"
