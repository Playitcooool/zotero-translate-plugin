#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")

npm run build

mkdir -p dist/plugin
mkdir -p dist/plugin/content
mkdir -p dist/plugin/background

# Copy bootstrap (root level)
cp dist/bootstrap.js dist/plugin/

# Copy content scripts
cp dist/content/selection-monitor.js dist/plugin/content/
cp dist/content/popup.js dist/plugin/content/

# Vite outputs CSS as style.css, but manifest expects content/popup.css
cp dist/style.css dist/plugin/content/popup.css

# Copy background scripts
cp dist/background/settings-manager.js dist/plugin/background/
cp dist/background/llm-client.js dist/plugin/background/

# Copy settings-ui (has hashed filename in dist)
cp dist/settings-ui*.js dist/plugin/ 2>/dev/null || true

# Copy manifest
cp src/manifest.json dist/plugin/

cd dist
zip -r "../zotero-translate-plugin-${VERSION}.xpi" plugin
echo "Built: zotero-translate-plugin-${VERSION}.xpi"
