import { getAllSettings, getSetting, type TranslateSettings } from './settings-manager';
import { validateSettings } from './ux-helpers';

export interface TranslateResult {
  success: boolean;
  translation?: string;
  error?: string;
  focusField?: keyof TranslateSettings | null;
  isSettingsError?: boolean;
}

type Provider = 'openai-compatible' | 'deepl' | 'libretranslate';

export async function translate(text: string, sourceLang: string = 'auto'): Promise<TranslateResult> {
  const validation = validateSettings(getAllSettings());
  if (!validation.ok) {
    return {
      success: false,
      error: validation.message,
      focusField: validation.focusField,
      isSettingsError: true,
    };
  }

  const provider = getSetting('provider') as Provider;

  if (!text.trim()) {
    return {
      success: false,
      error: '未检测到可翻译的文本',
    };
  }

  try {
    if (provider === 'deepl') {
      return await translateWithDeepL(text, sourceLang);
    }

    if (provider === 'libretranslate') {
      return await translateWithLibreTranslate(text, sourceLang);
    }

    return await translateWithOpenAICompatible(text, sourceLang);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    };
  }
}

async function translateWithOpenAICompatible(text: string, sourceLang: string): Promise<TranslateResult> {
  const apiAddress = getSetting('apiAddress');
  const apiKey = getSetting('apiKey');
  const modelName = getSetting('modelName');
  const targetLang = getSetting('targetLang');
  const promptTemplate = getSetting('promptTemplate');

  if (!apiAddress || !modelName) {
    return { success: false, error: '请先在设置中配置 API 地址和模型名称' };
  }

  const url = `${stripTrailingSlash(apiAddress)}/chat/completions`;
  const prompt = promptTemplate
    .replace(/\${text}/g, text)
    .replace(/\${targetLang}/g, targetLang)
    .replace(/\${sourceLang}/g, sourceLang);

  const response = await fetch(url, {
    method: 'POST',
    headers: buildJsonHeaders(apiKey),
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { success: false, error: await buildHttpErrorMessage(response, 'OpenAI Compatible API') };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    return { success: false, error: data.error.message };
  }

  const translation = data.choices?.[0]?.message?.content?.trim();
  return translation
    ? { success: true, translation }
    : { success: false, error: '未收到翻译结果' };
}

async function translateWithDeepL(text: string, sourceLang: string): Promise<TranslateResult> {
  const apiAddress = getSetting('apiAddress');
  const apiKey = getSetting('apiKey');
  const targetLang = normalizeDeepLTargetLang(getSetting('targetLang'));

  if (!apiAddress || !apiKey) {
    return { success: false, error: 'DeepL 需要配置 API 地址和 API Key' };
  }

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('target_lang', targetLang);
  if (sourceLang && sourceLang !== 'auto') {
    params.set('source_lang', sourceLang.toUpperCase());
  }

  const response = await fetch(`${stripTrailingSlash(apiAddress)}/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return { success: false, error: await buildHttpErrorMessage(response, 'DeepL') };
  }

  const data = (await response.json()) as {
    translations?: Array<{ text?: string }>;
    message?: string;
  };

  const translation = data.translations?.[0]?.text?.trim();
  return translation
    ? { success: true, translation }
    : { success: false, error: data.message || 'DeepL 未返回译文' };
}

async function translateWithLibreTranslate(text: string, sourceLang: string): Promise<TranslateResult> {
  const apiAddress = getSetting('apiAddress');
  const apiKey = getSetting('apiKey');
  const targetLang = normalizeSimpleLang(getSetting('targetLang'));
  const source = sourceLang && sourceLang !== 'auto' ? normalizeSimpleLang(sourceLang) : 'auto';

  if (!apiAddress) {
    return { success: false, error: 'LibreTranslate 需要配置 API 地址' };
  }

  const body: Record<string, string> = {
    q: text,
    source,
    target: targetLang,
    format: 'text',
  };
  if (apiKey) {
    body.api_key = apiKey;
  }

  const response = await fetch(`${stripTrailingSlash(apiAddress)}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { success: false, error: await buildHttpErrorMessage(response, 'LibreTranslate') };
  }

  const data = (await response.json()) as {
    translatedText?: string;
    error?: string;
  };

  return data.translatedText?.trim()
    ? { success: true, translation: data.translatedText.trim() }
    : { success: false, error: data.error || 'LibreTranslate 未返回译文' };
}

function buildJsonHeaders(apiKey: string): Record<string, string> {
  return apiKey
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      }
    : {
        'Content-Type': 'application/json',
      };
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeDeepLTargetLang(value: string): string {
  const normalized = normalizeSimpleLang(value).toUpperCase();
  const aliases: Record<string, string> = {
    ZH: 'ZH',
    CN: 'ZH',
    EN: 'EN',
    JA: 'JA',
    KO: 'KO',
    FR: 'FR',
    DE: 'DE',
    ES: 'ES',
    PT: 'PT',
    RU: 'RU',
  };
  return aliases[normalized] || 'ZH';
}

function normalizeSimpleLang(value: string): string {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    中文: 'zh',
    简体中文: 'zh',
    繁體中文: 'zh',
    english: 'en',
    英文: 'en',
    japanese: 'ja',
    日文: 'ja',
    korean: 'ko',
    韩文: 'ko',
    french: 'fr',
    法文: 'fr',
    german: 'de',
    德文: 'de',
    spanish: 'es',
    西班牙文: 'es',
    portuguese: 'pt',
    葡萄牙文: 'pt',
    russian: 'ru',
    俄文: 'ru',
  };
  return aliases[normalized] || normalized || 'zh';
}

async function buildHttpErrorMessage(response: Response, label: string): Promise<string> {
  const statusText = response.statusText?.trim();
  const fallback = `${label} 错误: ${response.status}${statusText ? ` ${statusText}` : ''}`;

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json() as {
        error?: string | { message?: string };
        message?: string;
        detail?: string;
      };
      const message = typeof data.error === 'string'
        ? data.error
        : data.error?.message || data.message || data.detail;
      return message ? `${fallback} - ${message}` : fallback;
    }

    const text = (await response.text()).trim();
    return text ? `${fallback} - ${text.slice(0, 200)}` : fallback;
  } catch {
    return fallback;
  }
}
