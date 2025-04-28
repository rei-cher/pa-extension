import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // *don’t* clear dist/ so we keep background.bundle.js
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'content/ema-upload.js'),
      formats: ['iife'],              // classic script
      fileName: () => 'ema-upload.bundle.js',
      name: 'emaUpload'
    },
    rollupOptions: {
      external: ['chrome']            // again, leave chrome.* APIs alone
    }
  }
});
