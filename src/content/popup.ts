import './popup.css';

let popupElement: HTMLElement | null = null;
let currentText = '';
let isLoading = false;

export function showPopup(text: string, rect: DOMRect): void {
  currentText = text;
  isLoading = true;
  renderPopup(rect);
  window.postMessage(
    { type: 'ZOTERO_TRANSLATE', text },
    '*'
  );
}

export function updatePopupTranslation(translation: string): void {
  isLoading = false;
  if (!popupElement) return;
  const body = popupElement.querySelector('.popup-body');
  if (body) {
    body.innerHTML = `<div class="popup-translation">${escapeHtml(translation)}</div>`;
  }
}

export function updatePopupError(error: string): void {
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

window.addEventListener('message', (e) => {
  if (e.data.type === 'ZOTERO_TRANSLATE_RESULT') {
    if (e.data.success) {
      updatePopupTranslation(e.data.translation);
    } else {
      updatePopupError(e.data.error || '翻译失败');
    }
  }
});
