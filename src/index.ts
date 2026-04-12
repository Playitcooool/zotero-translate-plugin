// Zotero plugin bootstrap entry point

import { translate } from './background/llm-client';

const hooks = {
  onStartup: async () => {
    try {
      await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise,
      ]);

      console.log('Zotero Translate Plugin starting...');
      const rootURI = (globalThis as any).rootURI;
      if (rootURI) {
        Zotero.PreferencePanes.register({
          pluginID: 'zoterotranslate@plugin.local',
          src: rootURI + 'chrome/content/preferences.xhtml',
          label: 'Zotero Translate',
        });
        console.log('Preference pane registered');
      }
    } catch (e) {
      console.error('Zotero Translate onStartup error:', e);
    }
  },

  onMainWindowLoad: async (window: Window) => {
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
  onShutdown: async () => {},
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
