import { getSetting } from './settings-manager';

export interface TranslateResult {
  success: boolean;
  translation?: string;
  error?: string;
}

export async function translate(text: string, sourceLang: string = 'auto'): Promise<TranslateResult> {
  const apiAddress = getSetting('apiAddress');
  const apiKey = getSetting('apiKey');
  const modelName = getSetting('modelName');
  const targetLang = getSetting('targetLang');
  const promptTemplate = getSetting('promptTemplate');

  if (!apiAddress || !modelName) {
    return { success: false, error: '请先在设置中配置 API 地址和模型名称' };
  }

  const url = `${apiAddress}/chat/completions`;

  // Apply template variables
  const prompt = promptTemplate
    .replace(/\${text}/g, text)
    .replace(/\${targetLang}/g, targetLang)
    .replace(/\${sourceLang}/g, sourceLang);

  const body = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, error: `API 错误: ${response.status}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const translation = data.choices?.[0]?.message?.content?.trim();
    if (!translation) {
      return { success: false, error: '未收到翻译结果' };
    }

    return { success: true, translation };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    };
  }
}
