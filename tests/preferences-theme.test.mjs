import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../addon/chrome/content/preferences.xhtml', import.meta.url), 'utf8');

const requiredTokens = [
  'Canvas',
  'CanvasText',
  'Field',
  'FieldText',
  'ButtonFace',
  'ButtonText',
];

for (const token of requiredTokens) {
  assert.match(
    source,
    new RegExp(`\\b${token}\\b`),
    `preferences.xhtml should use theme-aware system color ${token}`,
  );
}

const forbiddenHardcodedColors = [
  '#f6f7fb',
  '#edf1f6',
  '#172033',
  '#d9e2ee',
  '#5a6882',
];

for (const color of forbiddenHardcodedColors) {
  assert.ok(
    !source.includes(color),
    `preferences.xhtml should not hardcode theme color ${color}`,
  );
}
