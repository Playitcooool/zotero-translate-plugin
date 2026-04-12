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
  modelName: 'gpt-4',
  targetLang: '中文',
  promptTemplate: '你是专业翻译引擎。请将以下文本翻译成${targetLang}，只输出译文，不要添加解释、标题、引号、注释或任何额外内容：\n${text}',
  shortcut: 'Cmd+T',
};

const PREF_PREFIX = 'extensions.zotero.zoterotranslate.';

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
