// Zotero plugin bootstrap entry point

import { translate } from './background/llm-client';
import { getSetting, setSetting } from './background/settings-manager';

declare const Services: any;
const log = (msg: string) => {
  try {
    Services.console.logStringMessage(`ZoteroTranslate: ${msg}`);
  } catch (e) {
    Zotero.log(`ZoteroTranslate: ${msg}`);
  }
};

const hooks = {
  onStartup: async () => {
    try {
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
      Zotero.log(`onStartup error: ${e}`);
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

  onPrefsLoad: async () => {
    log('Prefs load called');
    // Load values into inputs - document is the prefs pane document
    const doc = document;
    const fields = ['apiAddress', 'apiKey', 'modelName', 'targetLang', 'promptTemplate'];
    fields.forEach(field => {
      const el = doc.getElementById(field) as HTMLInputElement;
      if (el) {
        el.value = getSetting(field as any) as string;
      }
    });

    // Set up save button
    const saveBtn = doc.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const apiAddress = (doc.getElementById('apiAddress') as HTMLInputElement)?.value || '';
        const apiKey = (doc.getElementById('apiKey') as HTMLInputElement)?.value || '';
        const modelName = (doc.getElementById('modelName') as HTMLInputElement)?.value || '';
        const targetLang = (doc.getElementById('targetLang') as HTMLInputElement)?.value || '';
        const promptTemplate = (doc.getElementById('promptTemplate') as HTMLTextAreaElement)?.value || '';

        setSetting('apiAddress', apiAddress);
        setSetting('apiKey', apiKey);
        setSetting('modelName', modelName);
        setSetting('targetLang', targetLang);
        setSetting('promptTemplate', promptTemplate);

        log('Settings saved');
        alert('Settings saved!');
      });
    }
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
