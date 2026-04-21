import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_HINT_DISMISS_COUNT,
  shouldReuseSelection,
  shouldShowShortcutHint,
  validateSettings,
} from '../src/background/ux-helpers.ts';

test('reuses selection only within the same reader context and freshness window', () => {
  const now = 1_000_000;
  const recentSelection = {
    text: 'selected text',
    capturedAt: now - 1_500,
    readerContext: 'reader-a',
  };

  assert.equal(
    shouldReuseSelection({
      currentText: '',
      lastSelection: recentSelection,
      now,
      maxAgeMs: 2_000,
      readerContext: 'reader-a',
    }),
    'selected text',
  );

  assert.equal(
    shouldReuseSelection({
      currentText: '',
      lastSelection: recentSelection,
      now,
      maxAgeMs: 2_000,
      readerContext: 'reader-b',
    }),
    '',
  );

  assert.equal(
    shouldReuseSelection({
      currentText: '',
      lastSelection: {
        ...recentSelection,
        capturedAt: now - 3_000,
      },
      now,
      maxAgeMs: 2_000,
      readerContext: 'reader-a',
    }),
    '',
  );
});

test('shows shortcut hint only when a fresh selection exists and the user has not dismissed it too many times', () => {
  assert.equal(
    shouldShowShortcutHint({
      selectionText: 'something',
      dismissCount: 0,
    }),
    true,
  );

  assert.equal(
    shouldShowShortcutHint({
      selectionText: '',
      dismissCount: 0,
    }),
    false,
  );

  assert.equal(
    shouldShowShortcutHint({
      selectionText: 'something',
      dismissCount: DEFAULT_HINT_DISMISS_COUNT,
    }),
    false,
  );
});

test('validates required settings per provider and reports focus field', () => {
  assert.deepEqual(
    validateSettings({
      provider: 'openai-compatible',
      apiPreset: 'custom',
      apiAddress: '',
      apiKey: '',
      modelName: '',
      targetLang: '中文',
      promptTemplate: 'Translate ${text}',
      shortcut: 'Mod+T',
    }),
    {
      ok: false,
      message: '请先完善设置：API 地址、模型名称',
      focusField: 'apiAddress',
      missingFields: ['apiAddress', 'modelName'],
    },
  );

  assert.deepEqual(
    validateSettings({
      provider: 'deepl',
      apiPreset: 'deepl-free',
      apiAddress: 'https://api-free.deepl.com/v2',
      apiKey: '',
      modelName: '',
      targetLang: '中文',
      promptTemplate: '',
      shortcut: 'Mod+T',
    }),
    {
      ok: false,
      message: '请先完善设置：API Key',
      focusField: 'apiKey',
      missingFields: ['apiKey'],
    },
  );

  assert.deepEqual(
    validateSettings({
      provider: 'libretranslate',
      apiPreset: 'libretranslate-default',
      apiAddress: 'https://libretranslate.com',
      apiKey: '',
      modelName: '',
      targetLang: '中文',
      promptTemplate: '',
      shortcut: 'Mod+T',
    }),
    {
      ok: true,
      message: '',
      focusField: null,
      missingFields: [],
    },
  );
});
