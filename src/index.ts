// Zotero plugin bootstrap entry point
// This is loaded by bootstrap.js via Services.scriptloader.loadSubScript

import { getAllSettings, setSetting } from './background/settings-manager';
import { translate } from './background/llm-client';
import { openSettingsWindow } from './background/settings-ui';
import { initContentScripts, injectStyles } from './content/content';

// Plugin instance - Zotero calls these hooks
const hooks = {
  onStartUp: async () => {
    console.log('Zotero Translate Plugin started');
  },

  onMainWindowLoad: async (window: Window) => {
    // Inject content scripts into the window
    injectStyles();
    initContentScripts();

    // Set up translation message listener
    window.addEventListener('message', async (e) => {
      if (e.data?.type === 'ZOTERO_TRANSLATE') {
        const text = e.data.text as string;
        if (!text) return;

        try {
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
        if (e.data.apiAddress !== undefined) setSetting('apiAddress', e.data.apiAddress);
        if (e.data.apiKey !== undefined) setSetting('apiKey', e.data.apiKey);
        if (e.data.modelName !== undefined) setSetting('modelName', e.data.modelName);
        if (e.data.targetLang !== undefined) setSetting('targetLang', e.data.targetLang);
      }

      if (e.data?.type === 'ZOTERO_OPEN_SETTINGS') {
        openSettingsWindow();
      }
    });

    // Set up keyboard shortcut Ctrl+Shift+, to open settings (cross-platform)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ',') {
        e.preventDefault();
        openSettingsWindow();
      }
    });
  },

  onMainWindowUnload: async (window: Window) => {
    // Cleanup if needed
  },

  onShutdown: async () => {
    // Cleanup
  },
};

// Make hooks globally accessible
(Zotero as any).__addonInstance__ = { hooks };

// Also export for potential direct use
export { hooks };
