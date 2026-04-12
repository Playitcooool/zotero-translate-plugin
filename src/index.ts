// Zotero plugin bootstrap entry point

import { translate } from './background/llm-client';

// Use Services.console.logStringMessage for logging in bootstrap context
declare const Services: any;
const log = (msg: string) => {
  try {
    Services.console.logStringMessage(`ZoteroTranslate: ${msg}`);
  } catch (e) {
    Zotero.log(`ZoteroTranslate: ${msg}`);
  }
};
const logError = (msg: string, e?: unknown) => {
  log(`ERROR: ${msg}`);
  if (e instanceof Error) log(e.message);
};

const hooks = {
  onStartup: async () => {
    try {
      log('Plugin starting...');
      const rootURI = (globalThis as any).rootURI;
      log(`rootURI = ${rootURI}`);
      if (rootURI) {
        log('Registering preference pane...');
        Zotero.PreferencePanes.register({
          pluginID: 'zoterotranslate@plugin.local',
          src: rootURI + 'chrome/content/preferences.xhtml',
          label: 'Zotero Translate',
        });
        log('Preference pane registered');
      } else {
        log('rootURI is undefined - cannot register preference pane');
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
