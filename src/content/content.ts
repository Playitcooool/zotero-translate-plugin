// Content script for PDF reader - handles selection monitoring and popup UI

let iconElement: HTMLElement | null = null;
let popupElement: HTMLElement | null = null;
let currentText = '';
let isLoading = false;

export function initContentScripts(): void {
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onMouseDown);
  window.addEventListener('message', onMessage);
}

function onMouseUp(e: MouseEvent): void {
  setTimeout(() => {
    const text = getSelectedText();
    if (!text) {
      hideIcon();
      return;
    }
    const rect = getSelectionRect();
    if (!rect) return;
    if (!iconElement) {
      iconElement = createIcon();
      document.body.appendChild(iconElement);
    }
    positionIcon(rect);
  }, 10);
}

function onMouseDown(e: MouseEvent): void {
  if (iconElement && !iconElement.contains(e.target as Node)) {
    hideIcon();
  }
}

function onMessage(e: MessageEvent): void {
  if (e.data?.type === 'ZOTERO_SHOW_POPUP' && e.data.text) {
    const rect = new DOMRect(e.data.rect.left, e.data.rect.top, e.data.rect.width, e.data.rect.height);
    showPopup(e.data.text, rect);
  }
  if (e.data?.type === 'ZOTERO_TRANSLATE_RESULT') {
    if (e.data.success) {
      updatePopupTranslation(e.data.translation);
    } else {
      updatePopupError(e.data.error || '翻译失败');
    }
  }
}

function createIcon(): HTMLElement {
  const icon = document.createElement('div');
  icon.id = 'zotero-translate-icon';
  icon.textContent = '📖';
  icon.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    display: none;
  `;
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = getSelectedText();
    const rect = getSelectionRect();
    if (!text || !rect) return;
    window.postMessage(
      { type: 'ZOTERO_SHOW_POPUP', text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } },
      '*'
    );
  });
  return icon;
}

function getSelectedText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).getBoundingClientRect();
}

function positionIcon(rect: DOMRect): void {
  if (!iconElement) return;
  iconElement.style.left = `${rect.right + 4}px`;
  iconElement.style.top = `${rect.top + window.scrollY - 4}px`;
  iconElement.style.display = 'block';
}

function hideIcon(): void {
  if (iconElement) iconElement.style.display = 'none';
}

function showPopup(text: string, rect: DOMRect): void {
  currentText = text;
  isLoading = true;
  renderPopup(rect);
  window.postMessage({ type: 'ZOTERO_TRANSLATE', text }, '*');
}

function updatePopupTranslation(translation: string): void {
  isLoading = false;
  if (!popupElement) return;
  const body = popupElement.querySelector('.popup-body');
  if (body) {
    body.innerHTML = `<div class="popup-translation">${escapeHtml(translation)}</div>`;
  }
}

function updatePopupError(error: string): void {
  isLoading = false;
  if (!popupElement) return;
  const body = popupElement.querySelector('.popup-body');
  if (body) {
    body.innerHTML = `
      <div class="popup-error">${escapeHtml(error)}</div>
      <button class="popup-retry">重试</button>
    `;
    body.querySelector('.popup-retry')?.addEventListener('click', () => {
      isLoading = true;
      body.innerHTML = '<div class="popup-loading">翻译中...</div>';
      window.postMessage({ type: 'ZOTERO_TRANSLATE', text: currentText }, '*');
    });
  }
}

function renderPopup(rect: DOMRect): void {
  if (popupElement) popupElement.remove();

  popupElement = document.createElement('div');
  popupElement.id = 'zotero-translate-popup';
  popupElement.innerHTML = `
    <div class="popup-header">
      <span class="popup-original">${escapeHtml(currentText)}</span>
      <button class="popup-close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-loading">翻译中...</div>
    </div>
  `;

  popupElement.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    max-width: 320px;
    min-width: 200px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    overflow: hidden;
  `;

  const left = rect.left + window.scrollX;
  const top = rect.bottom + window.scrollY + 8;
  popupElement.style.left = `${left}px`;
  popupElement.style.top = `${top}px`;

  popupElement.querySelector('.popup-close')?.addEventListener('click', hidePopup);
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleEsc);

  document.body.appendChild(popupElement);
}

function hidePopup(): void {
  if (popupElement) {
    popupElement.remove();
    popupElement = null;
  }
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleEsc);
}

function handleOutsideClick(e: MouseEvent): void {
  if (popupElement && !popupElement.contains(e.target as Node)) {
    const icon = document.getElementById('zotero-translate-icon');
    if (!icon?.contains(e.target as Node)) {
      hidePopup();
    }
  }
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') hidePopup();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// CSS styles
const css = `
#zotero-translate-popup {
  max-width: 320px;
  min-width: 200px;
}
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}
.popup-original {
  font-size: 12px;
  color: #666;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.popup-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  padding: 0 0 0 8px;
  line-height: 1;
}
.popup-close:hover {
  color: #333;
}
.popup-body {
  padding: 12px;
}
.popup-translation {
  color: #222;
  line-height: 1.6;
}
.popup-loading {
  color: #888;
  text-align: center;
  padding: 8px 0;
}
.popup-error {
  color: #e53935;
  font-size: 13px;
  margin-bottom: 8px;
}
.popup-retry {
  display: block;
  margin: 0 auto;
  padding: 4px 16px;
  font-size: 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}
.popup-retry:hover {
  background: #eee;
}
`;

export function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
