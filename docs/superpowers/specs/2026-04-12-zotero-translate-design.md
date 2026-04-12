# Zotero 划词翻译插件设计

## 概述

为 Zotero 桌面版开发一个划词翻译插件，调用本地部署的 OpenAI Compatible 接口完成翻译。

## 交互设计

### 翻译流程

1. 用户在 Zotero 阅读面板（PDF/文献）选中文本
2. 选中文字旁出现 📖 悬浮图标按钮
3. 用户点击图标 → 气泡弹出，显示加载动画
4. API 返回结果 → 气泡显示中文翻译
5. 点击气泡外或「×」关闭气泡

### 气泡设计

- **位置**：紧跟选中文字浮动（当选区滚动出视图时气泡随之隐藏）
- **样式**：圆角矩形，最大宽度 320px，白色背景，轻微阴影
- **内容**：仅显示译文（纯中文翻译结果）
- **关闭**：点击气泡外部或右上角「×」按钮
- **状态**：
  - 加载中：旋转图标 + "翻译中..."
  - 成功：中文翻译结果
  - 失败：红色错误提示 + 重试按钮

### 设置页面

在 Zotero 插件菜单中提供设置界面，字段如下：

| 字段 | 说明 | 默认值 |
|------|------|--------|
| API 地址 | OpenAI Compatible 端点，如 `http://localhost:11434/v1` | - |
| API Key | 密钥 | - |
| 模型名称 | 如 `gpt-4`、`qwen2` 等 | - |
| 目标语言 | 翻译目标语言，默认中文 | 中文 |
| 气泡最大宽度 | px | 320 |

## 技术架构

### 项目结构

```
src/
├── content/
│   ├── selection-monitor.ts   # 监听文本选择，注入悬浮图标
│   ├── popup.ts               # 翻译气泡 UI 渲染
│   └── styles/
│       └── popup.css          # 气泡样式
├── background/
│   └── settings.ts            # 设置读写（持久化到 Zotero store）
├── llm/
│   └── client.ts              # OpenAI Compatible API 调用
└── entry/
    └── index.ts                # 插件入口，注册菜单、初始化
```

### API 格式

```
POST {api_address}/v1/chat/completions
Headers: Authorization: Bearer {api_key}
Body: {
  model: "{model_name}",
  messages: [{ role: "user", content: "翻译成{target_lang}: {selected_text}" }]
}
```

### 错误处理

- 网络不可达：气泡显示"网络连接失败，请检查 API 地址"
- API 返回错误：气泡显示"翻译失败，请重试"
- 所有错误不打断用户，安静地在气泡内提示

## 技术选型

- **框架**：Zotero Plugin SDK
- **语言**：TypeScript
- **构建**：Vite
- **样式**：原生 CSS（无框架依赖）

## 实现顺序

1. 项目初始化（Zotero Plugin SDK + TypeScript + Vite）
2. 设置页面（API 配置持久化）
3. LLM 客户端（API 调用封装）
4. 选区监听 + 悬浮图标注入
5. 翻译气泡 UI
6. 气泡与 API 联动
