import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const prefsSource = readFileSync(new URL('../addon/prefs.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const preferencesSource = readFileSync(new URL('../addon/chrome/content/preferences.xhtml', import.meta.url), 'utf8');

test('stores defaults for hint dismissal and copy-close preference', () => {
  assert.match(prefsSource, /shortcutHintDismissCount/);
  assert.match(prefsSource, /closePopupAfterCopy/);
});

test('translation popup exposes settings recovery action', () => {
  assert.match(indexSource, /打开设置/);
  assert.match(indexSource, /zt-popup-open-settings/);
});

test('preferences move prompt template into an advanced section', () => {
  assert.match(preferencesSource, /高级选项/);
  assert.match(preferencesSource, /zt-advanced/);
});
