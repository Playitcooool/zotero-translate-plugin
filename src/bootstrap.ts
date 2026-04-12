// Zotero plugin bootstrap entry point
// This file is loaded when Zotero starts the plugin

export async function bootstrap({ id }: { id: string }): Promise<void> {
  console.log(`Zotero Translate Plugin loaded: ${id}`);

  // Set up message listener for translation requests from content script
  window.addEventListener('message', async (e) => {
    if (e.data?.type !== 'ZOTERO_TRANSLATE') return;

    const text = e.data.text as string;
    if (!text) return;

    try {
      const { translate } = await import('./background/llm-client');
      const result = await translate(text);

      // Send result back to content script
      window.postMessage({
        type: 'ZOTERO_TRANSLATE_RESULT',
        success: result.success,
        translation: result.translation,
        error: result.error,
      }, '*');
    } catch (err) {
      window.postMessage({
        type: 'ZOTERO_TRANSLATE_RESULT',
        success: false,
        error: err instanceof Error ? err.message : '未知错误',
      }, '*');
    }
  });
}