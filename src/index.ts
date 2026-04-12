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

  // Called when a reader (PDF) window loads
  onMainWindowLoad: async (window: Window) => {
    log('Main window loaded');

    // Wait for the reader to be ready
    const setupReader = async () => {
      // For PDF reader, we need to wait for the iframe to load
      const setupInterval = setInterval(() => {
        try {
          // Try to find the PDF reader iframe
          const iframe = window.document.querySelector('iframe[name="reader"]');
          if (iframe && iframe.contentWindow) {
            clearInterval(setupInterval);
            setupContextMenu(iframe.contentWindow as Window);
            log('Reader context menu set up');
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      }, 1000);

      // Stop after 30 seconds
      setTimeout(() => clearInterval(setupInterval), 30000);
    };

    setupReader();
  },

  onPrefsLoad: async () => {
    const doc = document;
    const fields = ['apiAddress', 'apiKey', 'modelName', 'targetLang', 'promptTemplate'];
    fields.forEach(field => {
      const el = doc.getElementById(field) as HTMLInputElement;
      if (el) {
        el.value = getSetting(field as any) as string;
      }
    });

    const saveBtn = doc.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        setSetting('apiAddress', (doc.getElementById('apiAddress') as HTMLInputElement)?.value || '');
        setSetting('apiKey', (doc.getElementById('apiKey') as HTMLInputElement)?.value || '');
        setSetting('modelName', (doc.getElementById('modelName') as HTMLInputElement)?.value || '');
        setSetting('targetLang', (doc.getElementById('targetLang') as HTMLInputElement)?.value || '');
        setSetting('promptTemplate', (doc.getElementById('promptTemplate') as HTMLTextAreaElement)?.value || '');
        log('Settings saved');
        alert('Settings saved!');
      });
    }
  },

  onMainWindowUnload: async () => {},
  onShutdown: async () => {},
};

function setupContextMenu(readerWindow: Window): void {
  // Create menu item for translation
  const menuPopup = readerWindow.document.getElementById('context-popup');
  if (!menuPopup) {
    log('Context popup not found');
    return;
  }

  const menuItem = readerWindow.document.createElement('menuitem');
  menuItem.id = 'zotero-translate-menuitem';
  menuItem.setAttribute('label', 'Translate with Zotero Translate');
  menuItem.addEventListener('click', async () => {
    const selection = readerWindow.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text) {
      const result = await translate(text);
      if (result.success && result.translation) {
        readerWindow.alert(`Translation:\n\n${result.translation}`);
      } else {
        readerWindow.alert(`Translation failed: ${result.error}`);
      }
    }
  });

  menuPopup.appendChild(menuItem);
  log('Added translate menu item to context popup');
}

async function doTranslate(text: string, window: Window): Promise<void> {
  const result = await translate(text);
  const message = result.success && result.translation
    ? `翻译:\n\n${result.translation}`
    : `翻译失败: ${result.error || '未知错误'}`;
  window.alert(message);
}

(Zotero as any).ZoteroTranslate = { hooks };
export { hooks };
