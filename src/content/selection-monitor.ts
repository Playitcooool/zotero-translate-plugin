let iconElement: HTMLElement | null = null;

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

document.addEventListener('mouseup', onMouseUp);
document.addEventListener('mousedown', (e) => {
  if (iconElement && !iconElement.contains(e.target as Node)) {
    hideIcon();
  }
});
