// Zotero plugin bootstrap entry point
// This is loaded by bootstrap.js via Services.scriptloader.loadSubScript

import { setSetting } from './background/settings-manager';
import { translate } from './background/llm-client';
import { initContentScripts, injectStyles } from './content/content';

// Plugin instance - Zotero calls these hooks
const hooks = {
  onStartup: async () => {
    // Wait for Zotero to be fully initialized before registering preference pane
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    console.log('Zotero Translate Plugin starting...');
    // Register preferences pane
    const rootURI = (globalThis as any).rootURI;
    if (rootURI) {
      Zotero.PreferencePanes.register({
        pluginID: 'zoterotranslate@plugin.local',
        src: rootURI + 'chrome/content/preferences.xhtml',
        label: 'Zotero Translate',
      });
    }
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
    });

    // Set up keyboard shortcut Ctrl+Shift+, to open settings (cross-platform)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ',') {
        e.preventDefault();
        Zotero.PreferencePanes.open('zoterotranslate@plugin.local');
      }
    });
  },

  onMainWindowUnload: async (window: Window) => {
    // Cleanup if needed
  },

  onShutdown: async () => {
    // Cleanup
  },

  onPrefsLoad: async (event: Event) => {
    // Preferences window loaded
    console.log('Zotero Translate preferences loaded');
  },
};

// Make hooks globally accessible - must match the name bootstrap.js expects
(Zotero as any).ZoteroTranslate = { hooks };

// Also export for potential direct use
export { hooks };
