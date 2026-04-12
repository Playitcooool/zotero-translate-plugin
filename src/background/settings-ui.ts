import { getAllSettings, setSetting } from './settings-manager';

export function openSettingsWindow(): void {
  const settings = getAllSettings();

  const html = `
    <html>
    <head>
      <title>Zotero Translate Settings</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 500px; }
        h2 { margin-top: 0; }
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
        <input id="api-address" value="${escapeHtml(settings.apiAddress)}" placeholder="http://localhost:11434/v1">
      </div>
      <div class="field">
        <label>API Key</label>
        <input id="api-key" type="password" value="${escapeHtml(settings.apiKey)}" placeholder="sk-...">
      </div>
      <div class="field">
        <label>模型名称</label>
        <input id="model-name" value="${escapeHtml(settings.modelName)}" placeholder="gpt-4">
      </div>
      <div class="field">
        <label>目标语言</label>
        <input id="target-lang" value="${escapeHtml(settings.targetLang)}" placeholder="中文">
      </div>
      <button id="save-btn">保存</button>
      <div id="saved" class="saved" style="display:none">已保存！</div>
      <script>
        document.getElementById('save-btn').addEventListener('click', function() {
          var apiAddress = document.getElementById('api-address').value;
          var apiKey = document.getElementById('api-key').value;
          var modelName = document.getElementById('model-name').value;
          var targetLang = document.getElementById('target-lang').value;
          window.postMessage({ type: 'ZOTERO_SETTINGS_SAVE', apiAddress, apiKey, modelName, targetLang }, '*');
          document.getElementById('saved').style.display = 'block';
          setTimeout(function() { document.getElementById('saved').style.display = 'none'; }, 2000);
        });
      </script>
    </body>
    </html>
  `;

  const win = window.open(
    'data:text/html;charset=utf-8,' + encodeURIComponent(html),
    'zotero-translate-settings',
    'width=500,height=400'
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
