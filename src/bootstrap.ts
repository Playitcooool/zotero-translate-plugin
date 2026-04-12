// Zotero plugin bootstrap entry point
// This file is loaded when Zotero starts the plugin

export async function bootstrap({ id }: { id: string }): Promise<void> {
  console.log(`Zotero Translate Plugin loaded: ${id}`);

  // Set up message listener for translation requests from content script
  window.addEventListener('message', async (e) => {
    if (e.data?.type === 'ZOTERO_TRANSLATE') {
      const text = e.data.text as string;
      if (!text) return;

      try {
        const { translate } = await import('./background/llm-client');
        const result = await translate(text);

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
    }

    if (e.data?.type === 'ZOTERO_SETTINGS_SAVE') {
      const { setSetting } = await import('./background/settings-manager');
      if (e.data.apiAddress !== undefined) setSetting('apiAddress', e.data.apiAddress);
      if (e.data.apiKey !== undefined) setSetting('apiKey', e.data.apiKey);
      if (e.data.modelName !== undefined) setSetting('modelName', e.data.modelName);
      if (e.data.targetLang !== undefined) setSetting('targetLang', e.data.targetLang);
    }

    if (e.data?.type === 'ZOTERO_OPEN_SETTINGS') {
      const { openSettingsWindow } = await import('./background/settings-ui');
      openSettingsWindow();
    }
  });

  // Register a keyboard shortcut to open settings (Ctrl+Shift+,)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === ',') {
      e.preventDefault();
      import('./background/settings-ui').then(({ openSettingsWindow }) => {
        openSettingsWindow();
      });
    }
  });
}