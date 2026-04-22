import { getAllSettings, type TranslateSettings, PROVIDERS, type Provider } from './settings-manager';
import { validateSettings } from './ux-helpers';

// Pre-compiled regex patterns for template replacement
const TEMPLATE_PATTERNS = {
  text: /\${text}/g,
  targetLang: /\${targetLang}/g,
  sourceLang: /\${sourceLang}/g,
} as const;

// Translation cache: key = text|sourceLang|targetLang, value = { result, timestamp }
const translationCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000]; // exponential backoff in ms

export async function translate(text: string, sourceLang: string = 'auto'): Promise<TranslateResult> {
  const allSettings = getAllSettings();
  const validation = validateSettings(allSettings);
  if (!validation.ok) {
    return {
      success: false,
      error: validation.message,
      focusField: validation.focusField,
      isSettingsError: true,
    };
  }

  const provider = allSettings.provider as Provider;

  if (!text.trim()) {
    return {
      success: false,
      error: '未检测到可翻译的文本',
    };
  }

  // Check cache first
  const cacheKey = `${text}|${sourceLang}|${allSettings.targetLang}`;
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { success: true, translation: cached.result };
  }

  try {
    if (provider === PROVIDERS.DEEPL) {
      return await translateWithDeepL(text, sourceLang, allSettings);
    }

    if (provider === PROVIDERS.LIBRETRANSLATE) {
      return await translateWithLibreTranslate(text, sourceLang, allSettings);
    }

    return await translateWithOpenAICompatible(text, sourceLang, allSettings);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    };
  }
}

async function translateWithOpenAICompatible(text: string, sourceLang: string, settings: TranslateSettings): Promise<TranslateResult> {
  const { apiAddress, apiKey, modelName, targetLang, promptTemplate } = settings;

  if (!apiAddress || !modelName) {
    return { success: false, error: '请先在设置中配置 API 地址和模型名称' };
  }

  const url = `${stripTrailingSlash(apiAddress)}/chat/completions`;
  const prompt = promptTemplate
    .replace(TEMPLATE_PATTERNS.text, text)
    .replace(TEMPLATE_PATTERNS.targetLang, targetLang)
    .replace(TEMPLATE_PATTERNS.sourceLang, sourceLang);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: buildJsonHeaders(apiKey),
        signal: AbortSignal.timeout(60_000),
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
      if (translation) {
        // Cache successful translation
        translationCache.set(`${text}|${sourceLang}|${targetLang}`, { result: translation, timestamp: Date.now() });
        return { success: true, translation };
      }

      lastError = new Error('未收到翻译结果');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on abort (timeout) errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '网络请求失败' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateWithDeepL(text: string, sourceLang: string, settings: TranslateSettings): Promise<TranslateResult> {
  const { apiAddress, apiKey, targetLang } = settings;

  if (!apiAddress || !apiKey) {
    return { success: false, error: 'DeepL 需要配置 API 地址和 API Key' };
  }

  const params = new URLSearchParams();
  params.set('text', text);
  params.set('target_lang', normalizeDeepLTargetLang(targetLang));
  if (sourceLang && sourceLang !== 'auto') {
    params.set('source_lang', sourceLang.toUpperCase());
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      const response = await fetch(`${stripTrailingSlash(apiAddress)}/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(30_000),
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
      if (translation) {
        translationCache.set(`${text}|${sourceLang}|${targetLang}`, { result: translation, timestamp: Date.now() });
        return { success: true, translation };
      }

      lastError = new Error(data.message || 'DeepL 未返回译文');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof DOMException && err.name === 'AbortError') {
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '网络请求失败' };
}

async function translateWithLibreTranslate(text: string, sourceLang: string, settings: TranslateSettings): Promise<TranslateResult> {
  const { apiAddress, apiKey, targetLang } = settings;

  if (!apiAddress) {
    return { success: false, error: 'LibreTranslate 需要配置 API 地址' };
  }

  const body: Record<string, string> = {
    q: text,
    source: sourceLang && sourceLang !== 'auto' ? normalizeSimpleLang(sourceLang) : 'auto',
    target: normalizeSimpleLang(targetLang),
    format: 'text',
  };
  if (apiKey) {
    body.api_key = apiKey;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }

    try {
      const response = await fetch(`${stripTrailingSlash(apiAddress)}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { success: false, error: await buildHttpErrorMessage(response, 'LibreTranslate') };
      }

      const data = (await response.json()) as {
        translatedText?: string;
        error?: string;
      };

      if (data.translatedText?.trim()) {
        const translation = data.translatedText.trim();
        translationCache.set(`${text}|${sourceLang}|${targetLang}`, { result: translation, timestamp: Date.now() });
        return { success: true, translation };
      }

      lastError = new Error(data.error || 'LibreTranslate 未返回译文');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof DOMException && err.name === 'AbortError') {
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '网络请求失败' };
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
  return normalizeSimpleLang(value).toUpperCase();
}

// Shared language alias lookup table
const LANG_ALIASES: Record<string, string> = {
  'zh': 'zh',
  'cn': 'zh',
  '中文': 'zh',
  '简体中文': 'zh',
  '繁體中文': 'zh',
  'en': 'en',
  'english': 'en',
  '英文': 'en',
  'ja': 'ja',
  'japanese': 'ja',
  '日文': 'ja',
  'ko': 'ko',
  'korean': 'ko',
  '韩文': 'ko',
  'fr': 'fr',
  'french': 'fr',
  '法文': 'fr',
  'de': 'de',
  'german': 'de',
  '德文': 'de',
  'es': 'es',
  'spanish': 'es',
  '西班牙文': 'es',
  'pt': 'pt',
  'portuguese': 'pt',
  '葡萄牙文': 'pt',
  'ru': 'ru',
  'russian': 'ru',
  '俄文': 'ru',
};

function normalizeSimpleLang(value: string): string {
  const normalized = value.trim().toLowerCase();
  return LANG_ALIASES[normalized] || normalized || 'zh';
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
