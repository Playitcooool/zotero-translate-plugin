import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: {
        bootstrap: './src/bootstrap.ts',
        'content/selection-monitor': './src/content/selection-monitor.ts',
        'content/popup': './src/content/popup.ts',
        'background/settings-manager': './src/background/settings-manager.ts',
        'background/llm-client': './src/background/llm-client.ts',
      },
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
