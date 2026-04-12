// Zotero plugin bootstrap entry point

import { translate } from './background/llm-client';
import { DEFAULT_SETTINGS, getSetting, setSetting } from './background/settings-manager';

declare const Services: any;
declare const Components: any;
const log = (msg: string) => {
  try {
    Services.console.logStringMessage(`ZoteroTranslate: ${msg}`);
  } catch (e) {
    Zotero.log(`ZoteroTranslate: ${msg}`);
  }
};

// Make translate globally accessible for injected scripts
(globalThis as any).translate = translate;

const READER_SELECTION_POPUP_LISTENER_ID = 'zotero-translate-selection-popup';
let latestSelectionText = '';
let lastNonEmptySelectionText = '';
let activeMainWindow: Window | null = null;
let translationPopupPosition: { right: number; bottom: number } | null = null;

const API_PRESETS: Record<string, { provider: string; apiAddress: string; apiKeyPlaceholder?: string; modelPlaceholder?: string }> = {
  ollama: {
    provider: 'openai-compatible',
    apiAddress: 'http://localhost:11434/v1',
    modelPlaceholder: 'qwen2.5:latest',
  },
  openai: {
    provider: 'openai-compatible',
    apiAddress: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    modelPlaceholder: 'gpt-4.1-mini',
  },
  deepseek: {
    provider: 'openai-compatible',
    apiAddress: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    modelPlaceholder: 'deepseek-chat',
  },
  openrouter: {
    provider: 'openai-compatible',
    apiAddress: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    modelPlaceholder: 'openai/gpt-4.1-mini',
  },
  siliconflow: {
    provider: 'openai-compatible',
    apiAddress: 'https://api.siliconflow.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    modelPlaceholder: 'Qwen/Qwen2.5-7B-Instruct',
  },
  groq: {
    provider: 'openai-compatible',
    apiAddress: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...',
    modelPlaceholder: 'llama-3.3-70b-versatile',
  },
  'deepl-free': {
    provider: 'deepl',
    apiAddress: 'https://api-free.deepl.com/v2',
    apiKeyPlaceholder: 'DeepL Auth Key',
  },
  'deepl-pro': {
    provider: 'deepl',
    apiAddress: 'https://api.deepl.com/v2',
    apiKeyPlaceholder: 'DeepL Auth Key',
  },
  'libretranslate-default': {
    provider: 'libretranslate',
    apiAddress: 'https://libretranslate.com',
    apiKeyPlaceholder: '可选',
  },
  custom: {
    provider: 'openai-compatible',
    apiAddress: '',
  },
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

      registerReaderSelectionListener();
    } catch (e) {
      Zotero.log(`onStartup error: ${e}`);
    }
  },

  onMainWindowLoad: async (window: Window) => {
    log('=== onMainWindowLoad CALLED ===');
    log(`window location: ${window?.location?.href || 'unknown'}`);
    activeMainWindow = window;
    setupMainWindowShortcuts(window);
  },

  onPrefsLoad: async (event: Event) => {
    log('Prefs load called');

    const target = event?.target as Element | null;
    log(`target: ${target?.nodeName || 'null'}, id: ${target?.id || 'none'}`);

    let doc: Document | undefined;
    if (target?.ownerDocument) {
      doc = target.ownerDocument as Document;
      log('Got doc from target.ownerDocument');
    }

    if (!doc) {
      try {
        doc = (globalThis as any).document;
        log('Got doc from globalThis.document');
      } catch (e) {
        log(`Error: ${e}`);
        return;
      }
    }

    if (!doc) {
      log('Could not get document');
      return;
    }

    const fields = ['provider', 'apiPreset', 'apiAddress', 'apiKey', 'modelName', 'targetLang', 'promptTemplate', 'shortcut'];
    fields.forEach(field => {
      const el = doc!.getElementById(field) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el && 'value' in el) {
        el.value = getSetting(field as any) as string;
      }
    });

    const saveBtn = doc.getElementById('saveBtn');
    const resetBtn = doc.getElementById('resetBtn');
    const statusEl = doc.getElementById('settingsStatus');
    const providerEl = doc.getElementById('provider') as HTMLSelectElement | null;
    const presetEl = doc.getElementById('apiPreset') as HTMLSelectElement | null;
    log(`saveBtn found: ${!!saveBtn}`);

    providerEl?.addEventListener('change', () => {
      syncPresetWithProvider(doc!);
      updateSettingsFormVisibility(doc!);
    });
    presetEl?.addEventListener('change', () => {
      applyApiPreset(doc!, presetEl.value);
      updateSettingsFormVisibility(doc!);
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const providerInput = doc!.getElementById('provider') as HTMLSelectElement | null;
        const presetInput = doc!.getElementById('apiPreset') as HTMLSelectElement | null;
        const apiAddressEl = doc!.getElementById('apiAddress') as HTMLInputElement | null;
        const apiKeyEl = doc!.getElementById('apiKey') as HTMLInputElement | null;
        const modelNameEl = doc!.getElementById('modelName') as HTMLInputElement | null;
        const targetLangEl = doc!.getElementById('targetLang') as HTMLInputElement | null;
        const promptTemplateEl = doc!.getElementById('promptTemplate') as HTMLTextAreaElement | null;
        const shortcutEl = doc!.getElementById('shortcut') as HTMLInputElement | null;

        setSetting('provider', providerInput?.value || DEFAULT_SETTINGS.provider);
        setSetting('apiPreset', presetInput?.value || DEFAULT_SETTINGS.apiPreset);
        setSetting('apiAddress', apiAddressEl?.value || '');
        setSetting('apiKey', apiKeyEl?.value || '');
        setSetting('modelName', modelNameEl?.value || '');
        setSetting('targetLang', targetLangEl?.value || '');
        setSetting('promptTemplate', promptTemplateEl?.value || '');
        setSetting('shortcut', shortcutEl?.value || 'Cmd+T');

        log('Settings saved');
        showSettingsStatus(statusEl, '已保存', false);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        applySettingsToForm(doc!, DEFAULT_SETTINGS);
        applyApiPreset(doc!, DEFAULT_SETTINGS.apiPreset);
        updateSettingsFormVisibility(doc!);
        showSettingsStatus(statusEl, '已恢复默认值，点击保存后生效', false);
      });
    }

    applyApiPreset(doc, (doc.getElementById('apiPreset') as HTMLSelectElement | null)?.value || DEFAULT_SETTINGS.apiPreset, false);
    updateSettingsFormVisibility(doc);
  },

  onMainWindowUnload: async (window: Window) => {
    if (activeMainWindow === window) {
      activeMainWindow = null;
    }
    teardownMainWindowShortcuts(window);
    hideTranslationPopup(window);
  },
  onShutdown: async () => {
    unregisterReaderSelectionListener();
  },
};

// Helper function to show alerts in XUL context
function showAlert(title: string, message: string): void {
  try {
    if (typeof Services !== 'undefined' && Services.prompt) {
      Services.prompt.alert(null, title, message);
    }
  } catch (e) {
    Zotero.log(`showAlert error: ${e}`);
  }
}

function doTranslate(text: string): void {
  showTranslationPopup({
    originalText: text,
    state: 'loading',
  });

  translate(text).then(result => {
    if (result.success && result.translation) {
      showTranslationPopup({
        originalText: text,
        state: 'success',
        translation: result.translation,
      });
    } else {
      showTranslationPopup({
        originalText: text,
        state: 'error',
        error: result.error || 'Unknown error',
      });
    }
  }).catch(err => {
    showTranslationPopup({
      originalText: text,
      state: 'error',
      error: String(err),
    });
  });
}

function setupMainWindowShortcuts(window: Window): void {
  try {
    const trackedWindow = window as Window & {
      __zoteroTranslateShortcutInstalled?: boolean;
      __zoteroTranslateShortcutHandler?: (event: KeyboardEvent) => void;
    };

    if (trackedWindow.__zoteroTranslateShortcutHandler) {
      window.removeEventListener('keydown', trackedWindow.__zoteroTranslateShortcutHandler, true);
      log('Replaced existing main window shortcut hook');
    }

    trackedWindow.__zoteroTranslateShortcutHandler = handleMainWindowKeydown;
    window.addEventListener('keydown', trackedWindow.__zoteroTranslateShortcutHandler, true);
    trackedWindow.__zoteroTranslateShortcutInstalled = true;
    log('Installed main window shortcut hook');
  } catch (e) {
    log(`Failed to set up main window shortcut hook: ${e}`);
  }
}

function teardownMainWindowShortcuts(window: Window): void {
  try {
    const trackedWindow = window as Window & {
      __zoteroTranslateShortcutInstalled?: boolean;
      __zoteroTranslateShortcutHandler?: (event: KeyboardEvent) => void;
    };

    if (trackedWindow.__zoteroTranslateShortcutHandler) {
      window.removeEventListener('keydown', trackedWindow.__zoteroTranslateShortcutHandler, true);
      delete trackedWindow.__zoteroTranslateShortcutHandler;
    }
    delete trackedWindow.__zoteroTranslateShortcutInstalled;
    log('Removed main window shortcut hook');
  } catch (e) {
    log(`Failed to tear down main window shortcut hook: ${e}`);
  }
}

function handleMainWindowKeydown(event: KeyboardEvent): void {
  try {
    activeMainWindow = event.currentTarget as Window;
    const shortcut = normalizeShortcut(getSetting('shortcut'));
    if (!shortcut) {
      return;
    }

    if (!matchesShortcut(event, shortcut)) {
      return;
    }

    const text = latestSelectionText.trim();
    const fallbackText = lastNonEmptySelectionText.trim();
    const textToTranslate = text || fallbackText;
    if (!textToTranslate) {
      log('Shortcut pressed without cached selection');
      return;
    }
    if (!text && fallbackText) {
      log(`Using last non-empty selection fallback: ${fallbackText.substring(0, 30)}...`);
    }

    event.preventDefault();
    event.stopPropagation();
    log(`Shortcut matched: ${shortcut}, text=${textToTranslate.substring(0, 30)}...`);
    doTranslate(textToTranslate);
  } catch (e) {
    log(`Failed during shortcut handling: ${e}`);
  }
}

function registerReaderSelectionListener(): void {
  try {
    const reader = (Zotero as any).Reader;
    if (!reader?.registerEventListener) {
      log('Zotero.Reader.registerEventListener is unavailable for selection listener');
      return;
    }

    unregisterReaderSelectionListener();
    reader.registerEventListener(
      'renderTextSelectionPopup',
      handleReaderSelectionPopup,
      READER_SELECTION_POPUP_LISTENER_ID,
    );
    log('Registered reader selection listener');
  } catch (e) {
    log(`Failed to register reader selection listener: ${e}`);
  }
}

function unregisterReaderSelectionListener(): void {
  try {
    const reader = (Zotero as any).Reader;
    if (!reader?.unregisterEventListener) {
      return;
    }
    reader.unregisterEventListener(
      'renderTextSelectionPopup',
      handleReaderSelectionPopup,
    );
    log('Unregistered reader selection listener');
  } catch (e) {
    log(`Failed to unregister reader selection listener: ${e}`);
  }
}

function handleReaderSelectionPopup(event: {
  reader?: unknown;
  params?: Record<string, unknown>;
}): void {
  try {
    if (!event.reader || typeof event.reader !== 'object') {
      return;
    }

    const selectedText = extractTextCandidate(
      (event.params?.annotation as { text?: unknown } | undefined)?.text,
    );
    if (!selectedText) {
      return;
    }

    latestSelectionText = selectedText;
    lastNonEmptySelectionText = selectedText;
    log(`Cached reader selection: ${selectedText.substring(0, 30)}...`);
  } catch (e) {
    log(`Failed to cache reader selection: ${e}`);
  }
}

function extractTextCandidate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeShortcut(shortcut: string): string {
  return shortcut
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/command|cmd/g, 'meta')
    .replace(/control|ctrl/g, 'ctrl')
    .replace(/option|opt|alt/g, 'alt')
    .replace(/shift/g, 'shift');
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+').filter(Boolean);
  if (!parts.length) {
    return false;
  }

  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));
  const normalizedKey = normalizeEventKey(event.key);

  return normalizedKey === key
    && event.metaKey === modifiers.has('meta')
    && event.ctrlKey === modifiers.has('ctrl')
    && event.altKey === modifiers.has('alt')
    && event.shiftKey === modifiers.has('shift');
}

function normalizeEventKey(key: string): string {
  return key.trim().toLowerCase();
}

function applySettingsToForm(doc: Document, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    const el = doc.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el && 'value' in el) {
      el.value = value;
    }
  }
}

function applyApiPreset(doc: Document, presetKey: string, forceAddress: boolean = true): void {
  const preset = API_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  const providerEl = doc.getElementById('provider') as HTMLSelectElement | null;
  const apiAddressEl = doc.getElementById('apiAddress') as HTMLInputElement | null;
  const apiKeyEl = doc.getElementById('apiKey') as HTMLInputElement | null;
  const modelNameEl = doc.getElementById('modelName') as HTMLInputElement | null;

  if (providerEl) {
    providerEl.value = preset.provider;
  }

  if (apiAddressEl && (forceAddress || !apiAddressEl.value.trim())) {
    apiAddressEl.value = preset.apiAddress;
  }

  if (apiKeyEl && preset.apiKeyPlaceholder) {
    apiKeyEl.placeholder = preset.apiKeyPlaceholder;
  }

  if (modelNameEl && preset.modelPlaceholder && (!modelNameEl.value.trim() || forceAddress)) {
    modelNameEl.value = preset.modelPlaceholder;
  }
}

function syncPresetWithProvider(doc: Document): void {
  const providerEl = doc.getElementById('provider') as HTMLSelectElement | null;
  const presetEl = doc.getElementById('apiPreset') as HTMLSelectElement | null;
  if (!providerEl || !presetEl) {
    return;
  }

  const activePreset = API_PRESETS[presetEl.value];
  if (activePreset?.provider === providerEl.value) {
    return;
  }

  const nextPreset = Object.entries(API_PRESETS).find(([, preset]) => preset.provider === providerEl.value)?.[0];
  presetEl.value = nextPreset || 'custom';
  applyApiPreset(doc, presetEl.value);
}

function updateSettingsFormVisibility(doc: Document): void {
  const provider = (doc.getElementById('provider') as HTMLSelectElement | null)?.value || DEFAULT_SETTINGS.provider;
  const isLlm = provider === 'openai-compatible';
  const helpEl = doc.getElementById('apiAddressHelp') as HTMLElement | null;

  doc.querySelectorAll('.zt-llm-only').forEach((el) => {
    (el as HTMLElement).style.display = isLlm ? '' : 'none';
  });

  if (helpEl) {
    helpEl.textContent = isLlm
      ? 'OpenAI Compatible 服务地址，例如 http://localhost:11434/v1。'
      : provider === 'deepl'
        ? 'DeepL 请填写 v2 根地址，例如 https://api-free.deepl.com/v2。'
        : 'LibreTranslate 请填写服务根地址，例如 https://libretranslate.com。';
  }
}

function showSettingsStatus(statusEl: HTMLElement | null, message: string, isError: boolean): void {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.style.visibility = 'visible';
  statusEl.style.color = isError ? '#b42318' : '#2f6b3b';
  const win = statusEl.ownerDocument.defaultView;
  win?.setTimeout(() => {
    statusEl.style.visibility = 'hidden';
  }, 2200);
}

type PopupState = 'loading' | 'success' | 'error';

function showTranslationPopup(payload: {
  originalText: string;
  state: PopupState;
  translation?: string;
  error?: string;
}): void {
  const window = activeMainWindow;
  if (!window) {
    if (payload.state === 'error') {
      showAlert('Translation Error', payload.error || 'Unknown error');
    }
    return;
  }

  const doc = window.document;
  ensureTranslationPopupStyles(doc);

  let overlay = doc.getElementById('zotero-translate-popup-overlay') as HTMLDivElement | null;
  if (!overlay) {
    overlay = doc.createElement('div');
    overlay.id = 'zotero-translate-popup-overlay';
    overlay.innerHTML = `
      <button class="zt-popup-floating-close" type="button" aria-label="关闭" title="关闭">
        <svg class="zt-popup-close-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4L12 12M12 4L4 12"></path>
        </svg>
      </button>
      <div class="zt-popup-context-menu" role="menu">
        <div class="zt-popup-context-item zt-popup-context-close" role="menuitem" tabindex="0">
          <span class="zt-popup-context-text">关闭</span>
        </div>
      </div>
      <div class="zt-popup-card" role="dialog" aria-labelledby="zotero-translate-popup-title">
        <div class="zt-popup-head">
          <div>
            <div id="zotero-translate-popup-title" class="zt-popup-title">翻译结果</div>
            <div class="zt-popup-subtitle">快捷查看当前选中文本的译文</div>
          </div>
        </div>
        <div class="zt-popup-section zt-popup-section-original">
          <div class="zt-popup-label">原文</div>
          <div class="zt-popup-original"></div>
        </div>
        <div class="zt-popup-section zt-popup-section-body">
          <div class="zt-popup-label">译文</div>
          <div class="zt-popup-body"></div>
        </div>
        <div class="zt-popup-actions">
          <button class="zt-popup-copy" type="button">复制译文</button>
          <button class="zt-popup-retry" type="button">重新翻译</button>
          <button class="zt-popup-dismiss" type="button">关闭</button>
        </div>
      </div>
    `;
    doc.documentElement.appendChild(overlay);

    initializeTranslationPopupDrag(window, overlay);
    overlay.querySelector('.zt-popup-floating-close')?.addEventListener('click', () => hideTranslationPopup(window));
    overlay.querySelector('.zt-popup-dismiss')?.addEventListener('click', () => hideTranslationPopup(window));
    overlay.querySelector('.zt-popup-context-close')?.addEventListener('mousedown', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      hideTranslationPopup(window);
    });
    overlay.querySelector('.zt-popup-context-close')?.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      hideTranslationPopup(window);
    });
    overlay.querySelector('.zt-popup-copy')?.addEventListener('click', () => {
      const text = (overlay?.querySelector('.zt-popup-copy') as HTMLButtonElement | null)?.dataset.translation || '';
      if (!text) {
        return;
      }
      copyToClipboard(text);
    });
    overlay.querySelector('.zt-popup-retry')?.addEventListener('click', () => {
      const text = (overlay?.querySelector('.zt-popup-retry') as HTMLButtonElement | null)?.dataset.originalText || '';
      if (text) {
        doTranslate(text);
      }
    });
    overlay.querySelector('.zt-popup-card')?.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showTranslationContextMenu(overlay!, event.clientX, event.clientY);
    });
    overlay.querySelector('.zt-popup-context-menu')?.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
    });
    window.addEventListener('mousedown', (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('#zotero-translate-popup-overlay')) {
        return;
      }
      hideTranslationContextMenu(overlay!);
    }, true);
  }

  const originalEl = overlay.querySelector('.zt-popup-original');
  const bodyEl = overlay.querySelector('.zt-popup-body');
  const copyBtn = overlay.querySelector('.zt-popup-copy') as HTMLButtonElement | null;
  const retryBtn = overlay.querySelector('.zt-popup-retry') as HTMLButtonElement | null;
  const card = overlay.querySelector('.zt-popup-card') as HTMLDivElement | null;

  if (originalEl) {
    originalEl.textContent = payload.originalText;
  }

  if (bodyEl) {
    if (payload.state === 'loading') {
      bodyEl.innerHTML = '<div class="zt-popup-loading"><span class="zt-popup-spinner"></span><span>翻译中...</span></div>';
    } else if (payload.state === 'success') {
      bodyEl.textContent = payload.translation || '';
    } else {
      bodyEl.innerHTML = `<div class="zt-popup-error">${escapeHtml(payload.error || '翻译失败')}</div>`;
    }
  }

  if (copyBtn) {
    copyBtn.disabled = payload.state !== 'success';
    copyBtn.dataset.translation = payload.translation || '';
  }

  if (retryBtn) {
    retryBtn.disabled = payload.state === 'loading';
    retryBtn.dataset.originalText = payload.originalText;
  }

  if (card) {
    applyTranslationPopupPosition(card);
  }
  applyFloatingCloseButtonPosition(overlay);

  overlay.setAttribute('data-visible', 'true');
}

function hideTranslationPopup(window: Window): void {
  const overlay = window.document.getElementById('zotero-translate-popup-overlay');
  if (overlay) {
    overlay.setAttribute('data-visible', 'false');
    hideTranslationContextMenu(overlay as HTMLDivElement);
  }
}

function initializeTranslationPopupDrag(window: Window, overlay: HTMLDivElement): void {
  const card = overlay.querySelector('.zt-popup-card') as HTMLDivElement | null;
  const handle = overlay.querySelector('.zt-popup-head') as HTMLDivElement | null;
  if (!card || !handle) {
    return;
  }

  let dragState: {
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  } | null = null;

  handle.addEventListener('mousedown', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }

    const rect = card.getBoundingClientRect();
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      startRight: Math.max(window.innerWidth - rect.right, 12),
      startBottom: Math.max(window.innerHeight - rect.bottom, 12),
    };
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event: MouseEvent) => {
    if (!dragState) {
      return;
    }

    const nextRight = dragState.startRight - (event.clientX - dragState.startX);
    const nextBottom = dragState.startBottom - (event.clientY - dragState.startY);
    translationPopupPosition = {
      right: clamp(nextRight, 12, Math.max(window.innerWidth - 180, 12)),
      bottom: clamp(nextBottom, 12, Math.max(window.innerHeight - 120, 12)),
    };
    applyTranslationPopupPosition(card);
    applyFloatingCloseButtonPosition(overlay);
  });

  window.addEventListener('mouseup', () => {
    dragState = null;
  });
}

function applyTranslationPopupPosition(card: HTMLDivElement): void {
  const position = translationPopupPosition || { right: 18, bottom: 18 };
  card.style.marginRight = `${position.right}px`;
  card.style.marginBottom = `${position.bottom}px`;
}

function applyFloatingCloseButtonPosition(overlay: HTMLDivElement): void {
  const button = overlay.querySelector('.zt-popup-floating-close') as HTMLButtonElement | null;
  if (!button) {
    return;
  }

  const position = translationPopupPosition || { right: 18, bottom: 18 };
  button.style.right = `${position.right + 10}px`;
  button.style.bottom = `${position.bottom + 10}px`;
}

function showTranslationContextMenu(overlay: HTMLDivElement, clientX: number, clientY: number): void {
  const menu = overlay.querySelector('.zt-popup-context-menu') as HTMLDivElement | null;
  if (!menu) {
    return;
  }

  menu.style.left = `${Math.max(clientX - 10, 12)}px`;
  menu.style.top = `${Math.max(clientY - 10, 12)}px`;
  menu.setAttribute('data-visible', 'true');
}

function hideTranslationContextMenu(overlay: HTMLDivElement): void {
  const menu = overlay.querySelector('.zt-popup-context-menu');
  if (menu) {
    menu.setAttribute('data-visible', 'false');
  }
}

function ensureTranslationPopupStyles(doc: Document): void {
  if (doc.getElementById('zotero-translate-popup-style')) {
    return;
  }

  const style = doc.createElement('style');
  style.id = 'zotero-translate-popup-style';
  style.textContent = `
    #zotero-translate-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      pointer-events: none;
    }
    #zotero-translate-popup-overlay[data-visible="true"] {
      display: flex;
    }
    .zt-popup-card {
      position: relative;
      width: min(400px, calc(100vw - 28px));
      max-height: min(72vh, 560px);
      overflow: auto;
      pointer-events: auto;
      margin-left: auto;
      margin-top: auto;
      border-radius: 16px;
      border: 1px solid rgba(197, 208, 221, 0.92);
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,253,0.98));
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
      color: #122033;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      animation: zt-popup-enter 0.18s ease-out;
    }
    .zt-popup-context-menu {
      position: fixed;
      display: none;
      min-width: 120px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid rgba(196, 206, 218, 0.95);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      z-index: 2147483649;
      pointer-events: auto;
    }
    .zt-popup-context-menu[data-visible="true"] {
      display: block;
    }
    .zt-popup-context-close {
      display: block;
      min-width: 120px;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.3;
      color: #0f172a;
      cursor: pointer;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      user-select: none;
    }
    .zt-popup-context-close:hover {
      background: #eef4ff;
    }
    .zt-popup-context-text {
      display: block;
      color: inherit;
      font-size: inherit;
    }
    .zt-popup-head {
      display: flex;
      justify-content: flex-start;
      gap: 12px;
      padding: 14px 14px 10px 14px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.95);
      cursor: move;
      user-select: none;
    }
    .zt-popup-title {
      font-size: 16px;
      font-weight: 700;
    }
    .zt-popup-subtitle {
      margin-top: 2px;
      font-size: 12px;
      color: #5c6b83;
    }
    .zt-popup-floating-close {
      position: fixed;
      width: 32px;
      min-width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(196, 206, 218, 0.95);
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      cursor: pointer;
      color: #0f172a;
      z-index: 2147483648;
      pointer-events: auto;
    }
    .zt-popup-floating-close:hover {
      background: #eef4ff;
      border-color: rgba(97, 146, 255, 0.65);
    }
    .zt-popup-close-icon {
      display: block;
      width: 14px;
      height: 14px;
    }
    .zt-popup-close-icon path {
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .zt-popup-floating-close,
    .zt-popup-actions button,
    .zt-popup-original,
    .zt-popup-body {
      user-select: text;
    }
    .zt-popup-section {
      padding: 10px 14px 0;
    }
    .zt-popup-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #5c6b83;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .zt-popup-original,
    .zt-popup-body {
      border-radius: 10px;
      background: rgba(245, 248, 252, 0.96);
      border: 1px solid rgba(222, 228, 236, 0.95);
      padding: 10px 12px;
      line-height: 1.65;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .zt-popup-section-original {
      padding-bottom: 2px;
    }
    .zt-popup-original {
      color: #475569;
      max-height: 74px;
      overflow: auto;
    }
    .zt-popup-body {
      color: #0f172a;
      min-height: 84px;
      max-height: 280px;
      overflow: auto;
    }
    .zt-popup-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 14px 14px;
    }
    .zt-popup-actions button {
      border: 1px solid rgba(196, 206, 218, 0.95);
      border-radius: 9px;
      background: #fff;
      padding: 7px 12px;
      color: #1e293b;
      font-size: 12px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .zt-popup-actions button:disabled {
      cursor: default;
      opacity: 0.5;
    }
    .zt-popup-copy {
      background: #1f5eff;
      border-color: #1f5eff;
      color: #fff;
    }
    .zt-popup-copy:disabled {
      background: #d7e3ff;
      border-color: #d7e3ff;
      color: #fff;
    }
    .zt-popup-loading {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #334155;
    }
    .zt-popup-spinner {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid rgba(148, 163, 184, 0.35);
      border-top-color: #2b6cb0;
      animation: zt-popup-spin 0.8s linear infinite;
    }
    .zt-popup-error {
      color: #b42318;
      font-weight: 600;
    }
    @keyframes zt-popup-enter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes zt-popup-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  doc.documentElement.appendChild(style);
}

function copyToClipboard(text: string): void {
  try {
    Components.classes['@mozilla.org/widget/clipboardhelper;1']
      .getService(Components.interfaces.nsIClipboardHelper)
      .copyString(text);
  } catch (e) {
    log(`Failed to copy translation: ${e}`);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

(Zotero as any).ZoteroTranslate = { hooks };
export { hooks };
