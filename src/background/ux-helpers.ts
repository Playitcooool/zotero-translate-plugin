import type { TranslateSettings } from './settings-manager';

export const DEFAULT_SELECTION_REUSE_MS = 2_000;
export const DEFAULT_HINT_DISMISS_COUNT = 3;

export interface SelectionSnapshot {
  text: string;
  capturedAt: number;
  readerContext: string;
}

export interface SettingsValidationResult {
  ok: boolean;
  message: string;
  focusField: keyof TranslateSettings | null;
  missingFields: Array<keyof TranslateSettings>;
}

export function shouldReuseSelection(options: {
  currentText: string;
  lastSelection: SelectionSnapshot | null;
  now: number;
  maxAgeMs?: number;
  readerContext: string;
}): string {
  const currentText = options.currentText.trim();
  if (currentText) {
    return currentText;
  }

  const lastSelection = options.lastSelection;
  if (!lastSelection?.text.trim()) {
    return '';
  }

  const maxAgeMs = options.maxAgeMs ?? DEFAULT_SELECTION_REUSE_MS;
  if (options.readerContext !== lastSelection.readerContext) {
    return '';
  }

  if (options.now - lastSelection.capturedAt > maxAgeMs) {
    return '';
  }

  return lastSelection.text.trim();
}

export function shouldShowShortcutHint(options: {
  selectionText: string;
  dismissCount: number;
  maxDismissCount?: number;
}): boolean {
  if (!options.selectionText.trim()) {
    return false;
  }

  const maxDismissCount = options.maxDismissCount ?? DEFAULT_HINT_DISMISS_COUNT;
  return options.dismissCount < maxDismissCount;
}

export function validateSettings(settings: TranslateSettings): SettingsValidationResult {
  const missingFields = getRequiredFields(settings.provider).filter((field) => !settings[field].trim());

  if (!missingFields.length) {
    return {
      ok: true,
      message: '',
      focusField: null,
      missingFields: [],
    };
  }

  return {
    ok: false,
    message: `请先完善设置：${missingFields.map((field) => FIELD_LABELS[field]).join('、')}`,
    focusField: missingFields[0],
    missingFields,
  };
}

function getRequiredFields(provider: string): Array<keyof TranslateSettings> {
  if (provider === 'deepl') {
    return ['apiAddress', 'apiKey'];
  }

  if (provider === 'libretranslate') {
    return ['apiAddress'];
  }

  return ['apiAddress', 'modelName'];
}

const FIELD_LABELS: Record<keyof TranslateSettings, string> = {
  provider: '翻译引擎',
  apiPreset: '接口预设',
  apiAddress: 'API 地址',
  apiKey: 'API Key',
  modelName: '模型名称',
  targetLang: '目标语言',
  promptTemplate: 'Prompt 模板',
  shortcut: '快捷键',
};
