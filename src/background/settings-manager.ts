export interface TranslateSettings {
  provider: string;
  apiPreset: string;
  apiAddress: string;
  apiKey: string;
  modelName: string;
  targetLang: string;
  promptTemplate: string;
  shortcut: string;
}

export const DEFAULT_SETTINGS: TranslateSettings = {
  provider: 'openai-compatible',
  apiPreset: 'ollama',
  apiAddress: 'http://localhost:11434/v1',
  apiKey: '',
  modelName: 'qwen2.5:latest',
  targetLang: '中文',
  promptTemplate: '你是专业翻译引擎。请将以下文本翻译成${targetLang}，只输出译文，不要添加解释、标题、引号、注释或任何额外内容：\n${text}',
  shortcut: 'Mod+T',
};

const PREF_PREFIX = 'extensions.zotero.zoterotranslate.';
export const DEFAULT_SHORTCUT_HINT_DISMISS_COUNT = 0;
export const DEFAULT_CLOSE_POPUP_AFTER_COPY = false;

export interface UxSettings {
  shortcutHintDismissCount: number;
  closePopupAfterCopy: boolean;
}

const DEFAULT_UX_SETTINGS: UxSettings = {
  shortcutHintDismissCount: DEFAULT_SHORTCUT_HINT_DISMISS_COUNT,
  closePopupAfterCopy: DEFAULT_CLOSE_POPUP_AFTER_COPY,
};

export function getSetting<K extends keyof TranslateSettings>(
  key: K
): TranslateSettings[K] {
  const fullKey = PREF_PREFIX + key;
  const value = Zotero.Prefs.get(fullKey);
  return value !== undefined ? value as TranslateSettings[K] : DEFAULT_SETTINGS[key];
}

export function setSetting<K extends keyof TranslateSettings>(
  key: K,
  value: TranslateSettings[K]
): void {
  Zotero.Prefs.set(PREF_PREFIX + key, value);
}

export function getAllSettings(): TranslateSettings {
  return {
    provider: getSetting('provider'),
    apiPreset: getSetting('apiPreset'),
    apiAddress: getSetting('apiAddress'),
    apiKey: getSetting('apiKey'),
    modelName: getSetting('modelName'),
    targetLang: getSetting('targetLang'),
    promptTemplate: getSetting('promptTemplate'),
    shortcut: getSetting('shortcut'),
  };
}

export function migrateLegacyDefaults(): void {
  const legacyPrompt = '你是专业翻译引擎。请将以下文本翻译成${targetLang}，只输出译文，不要添加解释、标题、引号、注释或任何额外内容：\n${text}';
  const isLegacyDefaultCombo =
    getSetting('provider') === 'openai-compatible'
    && getSetting('apiPreset') === 'ollama'
    && getSetting('apiAddress') === 'http://localhost:11434/v1'
    && getSetting('apiKey') === ''
    && getSetting('modelName') === 'gpt-4'
    && getSetting('targetLang') === '中文'
    && getSetting('promptTemplate') === legacyPrompt
    && getSetting('shortcut') === 'Mod+T';

  if (!isLegacyDefaultCombo) {
    return;
  }

  setSetting('modelName', DEFAULT_SETTINGS.modelName);
}

export function getUxSetting<K extends keyof UxSettings>(key: K): UxSettings[K] {
  const fullKey = PREF_PREFIX + key;
  const value = Zotero.Prefs.get(fullKey);
  return value !== undefined ? value as UxSettings[K] : DEFAULT_UX_SETTINGS[key];
}

export function setUxSetting<K extends keyof UxSettings>(key: K, value: UxSettings[K]): void {
  Zotero.Prefs.set(PREF_PREFIX + key, value);
}
