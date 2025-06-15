// ==================== IMPORTS ====================
import { defineConfig } from 'vite';
import { resolve } from 'path';

// ==================== CONFIGURATION ====================
export default defineConfig({
  // ==================== BASE & BUILD ====================
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  
  // ==================== DEV SERVER ====================
  server: {
    port: 3000,
    open: true,
  },
  
  // ==================== PATH RESOLUTION ====================
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  // ==================== PUBLIC ASSETS ====================
  publicDir: 'public',
  assetsInclude: ['**/*.webmanifest'],
});