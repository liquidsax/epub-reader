import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Relative paths — required for Electron file:// loading
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
