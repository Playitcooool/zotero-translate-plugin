# Zotero 划词翻译插件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Zotero 桌面版实现划词翻译插件，选中文本后点击图标弹出翻译气泡，调用本地 OpenAI Compatible LLM API。

**Architecture:** Zotero Add-on，基于 TypeScript + Vite 构建。Content Script 负责选区监听和气泡渲染；Background Script 负责设置持久化和 API 调用；两者通过 Zotero 的消息机制通信。

**Tech Stack:** Zotero Plugin SDK, TypeScript, Vite, 原生 CSS

---

## 文件结构

```
zotero-translate-plugin/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── manifest.json              # 插件清单（Zotero SDK 格式）
│   ├── bootstrap.ts               # 插件入口，注册菜单、初始化
│   ├── content/
│   │   ├── selection-monitor.ts  # 监听文本选择，注入悬浮图标
│   │   ├── popup.ts               # 翻译气泡 UI 渲染
│   │   └── popup.css              # 气泡样式
│   ├── background/
│   │   ├── settings-manager.ts    # 设置读写（持久化到 Zotero.Prefs）
│   │   └── llm-client.ts          # OpenAI Compatible API 调用
│   └── types/
│       └── zotero.d.ts            # Zotero 全局类型声明
└── dist/                          # Vite 构建输出
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/manifest.json`
- Create: `src/types/zotero.d.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "zotero-translate-plugin",
  "version": "0.1.0",
  "description": "Zotero 划词翻译插件，调用本地 LLM API",
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@zotero-plugin/sdk": "^1.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  entry: {
    bootstrap: './src/bootstrap.ts',
    'content/selection-monitor': './src/content/selection-monitor.ts',
    'content/popup': './src/content/popup.ts',
    'background/settings-manager': './src/background/settings-manager.ts',
    'background/llm-client': './src/background/llm-client.ts',
  },
  outDir: 'dist',
  rollupOptions: {
    output: {
      entryFileNames: '[name].js',
    },
  },
});
```

- [ ] **Step 4: 创建 src/manifest.json**

```json
{
  "manifest_version": 2,
  "name": "Zotero Translate",
  "version": "0.1.0",
  "description": "划词翻译插件，调用本地 LLM",
  "author": "Your Name",
  "id": "translate-plugin@example.com",
  "scripts": {
    "bootstrap": "bootstrap.js",
    "run": "bootstrap.js"
  },
  "resources": {
    "content": "content/"
  },
  "permissions": [
    "browser",
    "notifications"
  ],
  "content_scripts": [
    {
      "matches": ["chrome://zotero/content/reader/*"],
      "js": ["content/selection-monitor.js", "content/popup.js"],
      "css": ["content/popup.css"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 5: 创建 src/types/zotero.d.ts**

```typescript
declare const Zotero: {
  Prefs: {
    get(key: string): string | number | boolean;
    set(key: string, value: string | number | boolean): void;
    clear(key: string): void;
  };
  Plugin: {
    registerMenu(target: string, callback: () => void): void;
  };
  http: {
    request(url: string, options?: object): Promise<object>;
  };
  Addon: {
    getPlugin(id: string): { [key: string]: unknown };
  };
};

declare const Components: {
  classes: { [key: string]: unknown };
};
```

---

## Task 2: 设置管理（Settings Manager）

**Files:**
- Create: `src/background/settings-manager.ts`
- Modify: `src/types/zotero.d.ts`（补充类型）

- [ ] **Step 1: 创建 Settings 接口和默认值**

```typescript
// src/background/settings-manager.ts

export interface TranslateSettings {
  apiAddress: string;      // e.g. "http://localhost:11434/v1"
  apiKey: string;           // API key
  modelName: string;        // e.g. "gpt-4", "qwen2"
  targetLang: string;       // "中文"
  popupMaxWidth: number;    // 320
}

const DEFAULT_SETTINGS: TranslateSettings = {
  apiAddress: 'http://localhost:11434/v1',
  apiKey: '',
  modelName: 'gpt-4',
  targetLang: '中文',
  popupMaxWidth: 320,
};

const PREF_PREFIX = 'translate-plugin.';

export function getSetting<K extends keyof TranslateSettings>(
  key: K
): TranslateSettings[K] {
  const fullKey = PREF_PREFIX + key;
  const value = Zotero.Prefs.get(fullKey);
  return value !== undefined ? value as TranslateSettings[K] : DEFAULT_SETTINGS[key];
}

export function setSetting<K extends keyof TranslateSettings>(
  key: K,
  value: TranslateSettings[K]
): void {
  Zotero.Prefs.set(PREF_PREFIX + key, value);
}

export function getAllSettings(): TranslateSettings {
  return {
    apiAddress: getSetting('apiAddress'),
    apiKey: getSetting('apiKey'),
    modelName: getSetting('modelName'),
    targetLang: getSetting('targetLang'),
    popupMaxWidth: getSetting('popupMaxWidth'),
  };
}
```

- [ ] **Step 2: 验证设置读写正常**

手动测试：Zotero 控制台执行 `Zotero.Prefs.set('translate-plugin.test', 'hello')` 再 `Zotero.Prefs.get('translate-plugin.test')`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add settings manager with Zotero.Prefs persistence"
```

---

## Task 3: LLM 客户端（API 调用）

**Files:**
- Create: `src/background/llm-client.ts`

- [ ] **Step 1: 定义翻译函数签名**

```typescript
// src/background/llm-client.ts

import { getSetting } from './settings-manager';

export interface TranslateResult {
  success: boolean;
  translation?: string;
  error?: string;
}

export async function translate(text: string): Promise<TranslateResult> {
  const apiAddress = getSetting('apiAddress');
  const apiKey = getSetting('apiKey');
  const modelName = getSetting('modelName');
  const targetLang = getSetting('targetLang');

  if (!apiAddress || !modelName) {
    return { success: false, error: '请先在设置中配置 API 地址和模型名称' };
  }

  const url = `${apiAddress}/chat/completions`;

  const body = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: `翻译成${targetLang}：${text}`,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, error: `API 错误: ${response.status}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const translation = data.choices?.[0]?.message?.content?.trim();
    if (!translation) {
      return { success: false, error: '未收到翻译结果' };
    }

    return { success: true, translation };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    };
  }
}
```

- [ ] **Step 2: 用 mock 数据测试翻译函数逻辑**

用 curl 模拟：
```bash
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"翻译成中文：Hello world"}]}'
```

验证返回格式是否符合预期。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add LLM client for OpenAI Compatible API"
```

---

## Task 4: 选区监听（Selection Monitor）

**Files:**
- Create: `src/content/selection-monitor.ts`

- [ ] **Step 1: 监听 mouseup 事件，检测文本选择**

```typescript
// src/content/selection-monitor.ts

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
    window.postMessage(
      { type: 'ZOTERO_TRANSLATE_REQUEST', text: getSelectedText() },
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
```

- [ ] **Step 2: 手动测试图标注入**

在 Zotero PDF 阅读器中选中文本，验证图标是否出现在正确位置。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add selection monitor with floating icon injection"
```

---

## Task 5: 翻译气泡 UI（Popup）

**Files:**
- Create: `src/content/popup.ts`
- Create: `src/content/popup.css`

- [ ] **Step 1: 创建 popup.ts（气泡渲染和状态管理）**

```typescript
// src/content/popup.ts

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

// Listen for translation results from background
window.addEventListener('message', (e) => {
  if (e.data.type === 'ZOTERO_TRANSLATE_RESULT') {
    if (e.data.success) {
      updatePopupTranslation(e.data.translation);
    } else {
      updatePopupError(e.data.error || '翻译失败');
    }
  }
});
```

- [ ] **Step 2: 创建 popup.css**

```css
/* src/content/popup.css */

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
```

- [ ] **Step 3: 手动测试气泡渲染**

在 Zotero 中选中文本点击图标，验证气泡是否正确显示、加载状态、翻译结果。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add translation popup UI with loading/error states"
```

---

## Task 6: 气泡与 API 联动

**Files:**
- Modify: `src/content/selection-monitor.ts`（连接 popup 和 API）
- Modify: `src/bootstrap.ts`（消息路由）
- Modify: `src/content/popup.ts`（发送翻译请求到 background）

- [ ] **Step 1: 修改 selection-monitor.ts，点击图标时创建气泡**

在 `icon.addEventListener('click')` 中，调用 `showPopup(text, rect)` 而非直接 postMessage。

```typescript
// 替换原来的 click handler
icon.addEventListener('click', (e) => {
  e.stopPropagation();
  const rect = getSelectionRect();
  if (!rect) return;
  showPopup(getSelectedText(), rect);
});
```

- [ ] **Step 2: 修改 popup.ts，发送翻译请求到 background**

在 `renderPopup` 中发送消息到 background script：

```typescript
// 在 showPopup 函数中替换原来的 postMessage
// 改用 Zotero 消息机制或直接 fetch 到 API

window.postMessage(
  { type: 'ZOTERO_TRANSLATE', text },
  '*'
);
```

- [ ] **Step 3: 修改 bootstrap.ts，添加消息路由**

```typescript
// src/bootstrap.ts

export async function bootstrap({ id }: { id: string }): Promise<void> {
  // 注册菜单项（设置页面入口）
  Zotero.Menu.register(id, {
    label: 'Translate Settings',
    callback: () => {
      openSettingsWindow();
    },
  });

  // 监听来自 content script 的翻译请求
  Zotero.Message.listen((msg) => {
    if (msg.type === 'ZOTERO_TRANSLATE') {
      handleTranslate(msg.data.text).then((result) => {
        Zotero.Message.reply(msg, { type: 'ZOTERO_TRANSLATE_RESULT', ...result });
      });
    }
  });
}

async function handleTranslate(text: string) {
  const { translate } = await import('./background/llm-client');
  return translate(text);
}

function openSettingsWindow(): void {
  const { getAllSettings, setSetting } = require('./background/settings-manager');
  // 打开设置窗口（使用 Zotero 的 dialog 或 prompt）
  const apiAddress = prompt('API 地址:', getAllSettings().apiAddress);
  if (apiAddress !== null) setSetting('apiAddress', apiAddress);
  // ... 其他字段
}
```

- [ ] **Step 4: 用实际 API 测试完整流程**

启动本地 LLM 服务（Ollama 等），配置 API 地址，在 Zotero 中选中文本验证翻译结果。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: connect popup to LLM API via Zotero message system"
```

---

## Task 7: 设置界面（Settings UI）

**Files:**
- Create: `src/background/settings-ui.ts`（设置窗口）

- [ ] **Step 1: 创建设置窗口函数**

```typescript
// src/background/settings-ui.ts

import { getAllSettings, setSetting, TranslateSettings } from './settings-manager';

export function openSettingsWindow(): void {
  const settings = getAllSettings();

  const html = `
    <html>
    <head>
      <title>Zotero Translate Settings</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 500px; }
        .field { margin-bottom: 16px; }
        label { display: block; font-weight: 600; margin-bottom: 4px; }
        input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        button { padding: 8px 20px; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #3a7fc8; }
        .saved { color: green; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h2>翻译设置</h2>
      <div class="field">
        <label>API 地址</label>
        <input id="api-address" value="${settings.apiAddress}" placeholder="http://localhost:11434/v1">
      </div>
      <div class="field">
        <label>API Key</label>
        <input id="api-key" type="password" value="${settings.apiKey}" placeholder="sk-...">
      </div>
      <div class="field">
        <label>模型名称</label>
        <input id="model-name" value="${settings.modelName}" placeholder="gpt-4">
      </div>
      <div class="field">
        <label>目标语言</label>
        <input id="target-lang" value="${settings.targetLang}" placeholder="中文">
      </div>
      <button onclick="saveSettings()">保存</button>
      <div id="saved" class="saved" style="display:none">已保存！</div>
      <script>
        function saveSettings() {
          const { setSetting } = window.arguments[0];
          setSetting('apiAddress', document.getElementById('api-address').value);
          setSetting('apiKey', document.getElementById('api-key').value);
          setSetting('modelName', document.getElementById('model-name').value);
          setSetting('targetLang', document.getElementById('target-lang').value);
          document.getElementById('saved').style.display = 'block';
          setTimeout(() => document.getElementById('saved').style.display = 'none', 2000);
        }
      </script>
    </body>
    </html>
  `;

  // 使用 Zotero 的 window.open for HTML content
  const win = window.open(
    'data:text/html;charset=utf-8,' + encodeURIComponent(html),
    'zotero-translate-settings',
    'width=500,height=400'
  );
}
```

- [ ] **Step 2: 修改 bootstrap.ts 使用新的设置窗口**

```typescript
// 在 bootstrap 中导入并使用
import { openSettingsWindow } from './background/settings-ui';

Zotero.Menu.register(id, {
  label: '翻译设置',
  callback: openSettingsWindow,
});
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add settings UI window"
```

---

## Task 8: 构建和打包

**Files:**
- Modify: `package.json`（添加构建脚本）
- Create: `Makefile` 或 `build.sh`（打包脚本）

- [ ] **Step 1: 创建 build.sh 打包脚本**

```bash
#!/bin/bash
# build.sh

set -e

npm run build

# 创建插件包
PLUGIN_ID="translate-plugin@example.com"
VERSION=$(node -p "require('./package.json').version")

mkdir -p dist/plugin
cp dist/*.js dist/plugin/
cp -r dist/content dist/plugin/
cp dist/background dist/plugin/
cp src/manifest.json dist/plugin/

cd dist
zip -r "../zotero-translate-plugin-${VERSION}.xpi" plugin
echo "Built: zotero-translate-plugin-${VERSION}.xpi"
```

- [ ] **Step 2: 验证构建输出**

```bash
chmod +x build.sh
./build.sh
ls -la *.xpi
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add build and packaging scripts"
```

---

## 实施顺序

1. Task 1: 项目初始化
2. Task 2: 设置管理
3. Task 3: LLM 客户端
4. Task 4: 选区监听
5. Task 5: 翻译气泡 UI
6. Task 6: 气泡与 API 联动
7. Task 7: 设置界面
8. Task 8: 构建打包

---

## 自检清单

- [ ] Spec 覆盖：所有设计需求都有对应 Task
- [ ] 占位符检查：无 "TBD"、"TODO" 等未完成标记
- [ ] 类型一致性：所有接口（TranslateSettings、TranslateResult）在 Task 间一致
- [ ] Zotero API 调用方式正确（Prefs、Message、Menu）
- [ ] API 错误处理完整（网络失败、API 错误、格式错误）
