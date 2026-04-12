// Zotero plugin bootstrap entry point

import { translate } from './background/llm-client';

// Use Zotero.log instead of console.log in bootstrap context
const log = (msg: string) => Zotero.log(`ZoteroTranslate: ${msg}`);
const logError = (msg: string, e?: unknown) => {
  Zotero.log(`ZoteroTranslate ERROR: ${msg}`);
  if (e instanceof Error) Zotero.log(e.message);
};

const hooks = {
  onStartup: async () => {
    try {
      await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise,
      ]);

      log('Plugin starting...');
      const rootURI = (globalThis as any).rootURI;
      if (rootURI) {
        Zotero.PreferencePanes.register({
          pluginID: 'zoterotranslate@plugin.local',
          src: rootURI + 'chrome/content/preferences.xhtml',
          label: 'Zotero Translate',
        });
        log('Preference pane registered');
      }
    } catch (e) {
      logError('onStartup failed', e);
    }
  },

  onMainWindowLoad: async (window: Window) => {
    log('Main window loaded');
    // Keyboard shortcut: Ctrl/Cmd+Shift+T to translate selected text
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        if (text) {
          doTranslate(text, window);
        }
      }
    });
  },

  onMainWindowUnload: async () => {},
  onShutdown: async () => {
    log('Plugin shutting down');
  },
};

async function doTranslate(text: string, window: Window): Promise<void> {
  const result = await translate(text);
  const message = result.success && result.translation
    ? `翻译:\n\n${result.translation}`
    : `翻译失败: ${result.error || '未知错误'}`;
  window.alert(message);
}

(Zotero as any).ZoteroTranslate = { hooks };
export { hooks };
