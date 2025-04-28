import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // wipe dist/ on each background build
    emptyOutDir: true,
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'background.js'),
      formats: ['es'],
      fileName: () => 'background.bundle.js',
      name: 'background'
    },
    rollupOptions: {
      // don’t bundle the chrome API
      external: ['chrome']
    }
  }
});
