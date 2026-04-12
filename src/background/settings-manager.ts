export interface TranslateSettings {
  apiAddress: string;      // e.g. "http://localhost:11434/v1"
  apiKey: string;          // API key
  modelName: string;       // e.g. "gpt-4", "qwen2"
  targetLang: string;      // "中文"
  popupMaxWidth: number;   // 320
}

const DEFAULT_SETTINGS: TranslateSettings = {
  apiAddress: 'http://localhost:11434/v1',
  apiKey: '',
  modelName: 'gpt-4',
  targetLang: '中文',
  popupMaxWidth: 320,
};

const PREF_PREFIX = 'translate-plugin.';

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
    popupMaxWidth: getSetting('popupMaxWidth'),
  };
}
