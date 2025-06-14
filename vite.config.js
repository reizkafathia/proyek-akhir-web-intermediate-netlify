import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/', // <- FIX: HARUS INI untuk Netlify

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },

  server: {
    port: 3000,
    open: true,
    host: 'localhost',
    hmr: {
      port: 3000,
      host: 'localhost',
      clientPort: 3000
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
