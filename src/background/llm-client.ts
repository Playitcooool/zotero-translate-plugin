import { getAllSettings, type TranslateSettings, PROVIDERS, type Provider } from './settings-manager';
import { validateSettings } from './ux-helpers';

export interface TranslateResult {
  success: boolean;
  translation?: string;
  error?: string;
  focusField?: keyof TranslateSettings | null;
  isSettingsError?: boolean;
}

// Pre-compiled regex patterns for template replacement
const TEMPLATE_PATTERNS = {
  text: /\${text}/g,
  targetLang: /\${targetLang}/g,
  sourceLang: /\${sourceLang}/g,
} as const;

// Bounded translation cache with LRU eviction
const translationCache = new Map<string, { result: string; timestamp: number }>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2000]; // exponential backoff in ms

function getCacheKey(text: string, sourceLang: string, targetLang: string, provider: Provider): string {
  return `${provider}|${text}|${sourceLang}|${targetLang}`;
}

function setCacheEntry(key: string, result: string): void {
  // Evict oldest entries if cache is full
  if (translationCache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of translationCache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      translationCache.delete(oldestKey);
    }
  }
  translationCache.set(key, { result, timestamp: Date.now() });
}

function getCachedTranslation(key: string): string | null {
  const cached = translationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }
  return null;
}

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

  // Check cache first (include provider in key)
  const cacheKey = getCacheKey(text, sourceLang, allSettings.targetLang, provider);
  const cachedResult = getCachedTranslation(cacheKey);
  if (cachedResult) {
    return { success: true, translation: cachedResult };
  }

  try {
    if (provider === PROVIDERS.DEEPL) {
      return await translateWithDeepL(text, sourceLang, allSettings, provider);
    }

    if (provider === PROVIDERS.LIBRETRANSLATE) {
      return await translateWithLibreTranslate(text, sourceLang, allSettings, provider);
    }

    return await translateWithOpenAICompatible(text, sourceLang, allSettings, provider);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    };
  }
}

async function translateWithOpenAICompatible(text: string, sourceLang: string, settings: TranslateSettings, provider: Provider): Promise<TranslateResult> {
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
        const cacheKey = getCacheKey(text, sourceLang, targetLang, provider);
        setCacheEntry(cacheKey, translation);
        return { success: true, translation };
      }

      lastError = new Error('未收到翻译结果');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on abort (timeout) errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('翻译超时，请检查网络连接或API服务状态');
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '翻译失败，请重试或检查API配置' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateWithDeepL(text: string, sourceLang: string, settings: TranslateSettings, provider: Provider): Promise<TranslateResult> {
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
        setCacheEntry(getCacheKey(text, sourceLang, targetLang, provider), translation);
        return { success: true, translation };
      }

      lastError = new Error(data.message || 'DeepL 未返回译文');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('翻译超时，请检查网络连接或API服务状态');
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '翻译失败，请重试或检查API配置' };
}

async function translateWithLibreTranslate(text: string, sourceLang: string, settings: TranslateSettings, provider: Provider): Promise<TranslateResult> {
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
        setCacheEntry(getCacheKey(text, sourceLang, targetLang, provider), translation);
        return { success: true, translation };
      }

      lastError = new Error(data.error || 'LibreTranslate 未返回译文');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new Error('翻译超时，请检查网络连接或API服务状态');
        break;
      }
    }
  }

  return { success: false, error: lastError?.message || '翻译失败，请重试或检查API配置' };
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
