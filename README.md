# Zotero Translate

一款轻量的 Zotero 7 PDF 划词翻译插件，支持自定义快捷键，兼容本地 `Ollama` 模型以及 `OpenAI Compatible / LLM`、`DeepL`、`LibreTranslate` 等翻译服务。

![Zotero Translate Preview](./docs/images/preview.png)

## Highlights

- 面向 `Zotero 7` 的 PDF 选中文本翻译
- 默认快捷键：`Windows / Linux = Ctrl+T`，`macOS = Cmd+T`
- 支持 `OpenAI Compatible / LLM`、`DeepL`、`LibreTranslate`
- 内置常用预设：`Ollama`、`OpenAI`、`DeepSeek`、`OpenRouter`、`SiliconFlow`、`Groq`、`DeepL Free / Pro`
- 可拖动的翻译面板，默认显示在右下角
- 支持复制译文、重新翻译、右键关闭

## Quick Start

### 1. 下载插件

- [直接下载 `.xpi`](https://github.com/Playitcooool/zotero-translate-plugin/releases/latest/download/zotero-translate.xpi)
- [查看 Releases 页面](https://github.com/Playitcooool/zotero-translate-plugin/releases)

### 2. 安装到 Zotero

1. 打开 Zotero
2. 进入 `Tools -> Plugins`
3. 点击右上角设置按钮
4. 选择 `Install Add-on From File...`
5. 选择下载好的 `zotero-translate.xpi`

### 3. 开始使用

1. 在 Zotero 中打开 PDF
2. 选中需要翻译的文本
3. 按下快捷键：`Windows / Linux = Ctrl+T`，`macOS = Cmd+T`
4. 在右下角翻译面板中查看结果

## 必要配置

首次使用前，请先在插件设置页选择翻译服务并填写对应配置。

- `OpenAI Compatible / LLM`：填写 `API 地址`、`API Key`、`模型名称`、`Prompt 模板`
- `DeepL`：填写 `DeepL Free / Pro` 和 `API Key`
- `LibreTranslate`：填写接口地址，必要时填写 `API Key`

默认 Prompt 会强制模型只输出译文，不添加解释或额外说明。

## Providers

### OpenAI Compatible / LLM

- 本地 `Ollama`
- `OpenAI`
- `DeepSeek`
- `OpenRouter`
- `SiliconFlow`
- `Groq`
- 任意兼容 OpenAI Chat Completions 的接口

### DeepL

- 适合追求传统翻译质量和稳定性的用户

### LibreTranslate

- 适合想使用开源翻译服务或自托管实例的用户

## Settings

插件设置页支持：

- 翻译引擎切换
- 接口预设切换
- API 地址配置
- API Key 配置
- 模型名称配置
- 目标语言配置
- Prompt 模板配置
- 快捷键配置

当你切换不同翻译引擎时，设置页会自动隐藏不适用的字段。

默认快捷键：

- `Windows / Linux`：`Ctrl+T`
- `macOS`：`Cmd+T`
- 可在设置页改成其他组合键，例如 `Ctrl+Shift+T` 或 `Cmd+Shift+T`

## Compatibility

- 主要面向 `Zotero 7`
- 已按桌面端 `macOS / Windows / Linux` 的快捷键习惯做统一处理
- 当前版本依赖 Zotero Reader 的文本选区事件
- 对更高主版本 Zotero 的兼容性暂未做完整验证

## Development

```bash
npm install
npm run build
```

构建完成后安装生成的 `.xpi` 插件包。

开发模式：

```bash
npm run watch
```

## Project Structure

```text
addon/
  chrome/content/preferences.xhtml   # 设置页
  bootstrap.js                       # 插件启动入口
src/
  background/llm-client.ts           # 多翻译后端分发
  background/settings-manager.ts     # 插件设置存储
  index.ts                           # 快捷键、选区缓存、翻译面板
typings/
  prefs.d.ts                         # 偏好设置类型声明
```

## Notes

- 翻译触发依赖 Zotero Reader 的文本选区事件
- 如果切换了接口预设，建议重新检查 `API 地址`、`API Key`、`模型名称`

## License

MIT
