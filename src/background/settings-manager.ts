export interface TranslateSettings {
  apiAddress: string;
  apiKey: string;
  modelName: string;
  targetLang: string;
  promptTemplate: string;
}

const DEFAULT_SETTINGS: TranslateSettings = {
  apiAddress: 'http://localhost:11434/v1',
  apiKey: '',
  modelName: 'gpt-4',
  targetLang: '中文',
  promptTemplate: '翻译成${targetLang}：${text}',
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
    apiAddress: getSetting('apiAddress'),
    apiKey: getSetting('apiKey'),
    modelName: getSetting('modelName'),
    targetLang: getSetting('targetLang'),
    promptTemplate: getSetting('promptTemplate'),
  };
}
