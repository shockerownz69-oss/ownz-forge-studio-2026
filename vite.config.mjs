import { defineConfig } from 'vite';

export default defineConfig({
  root: 'editor',
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/terminal-v8': 'http://127.0.0.1:3003',
      '/api/terminal': 'http://127.0.0.1:3002',
      '/api': 'http://127.0.0.1:3001'
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
