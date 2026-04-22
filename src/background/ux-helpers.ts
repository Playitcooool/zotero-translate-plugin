import type { TranslateSettings } from './settings-manager';

export const DEFAULT_SELECTION_REUSE_MS = 5_000;
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

export function validateShortcut(shortcut: string): { ok: boolean; message: string } {
  const trimmed = shortcut.trim();
  if (!trimmed) {
    return { ok: false, message: '快捷键不能为空' };
  }

  const parts = trimmed.split('+').filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, message: '快捷键格式无效' };
  }

  const key = parts[parts.length - 1].toLowerCase();
  const modifiers = new Set(parts.slice(0, -1));

  // Key must be a single character or a named key
  const validKeys = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    'space', 'enter', 'escape', 'escape', 'tab', 'backspace', 'delete',
    'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
  ];

  if (!validKeys.includes(key) && key.length > 1) {
    return { ok: false, message: `无效的快捷键: ${key}` };
  }

  // Check for valid modifiers
  const validModifiers = ['mod', 'meta', 'ctrl', 'alt', 'shift'];
  for (const mod of modifiers) {
    if (!validModifiers.includes(mod.toLowerCase())) {
      return { ok: false, message: `无效的修饰键: ${mod}` };
    }
  }

  // Must have at least one modifier (mod/ctrl/etc) + a key
  if (modifiers.size === 0) {
    return { ok: false, message: '快捷键至少需要一个修饰键 (如 Mod、Ctrl、Alt)' };
  }

  return { ok: true, message: '' };
}
