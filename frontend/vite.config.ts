import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 8000000
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Silacod',
        short_name: 'Silacod',
        description: 'Moroccan Dropshipping Platform',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    /**
     * Overridable so deploy.sh can build into a staging directory and swap it in
     * atomically. `vite build` empties its output directory before writing, so
     * building straight into the live dist/ makes the site serve 404s for the
     * duration of the build.
     *
     * scripts/prerender.mjs reads the same variable.
     */
    outDir: process.env.VITE_OUT_DIR || 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Used by scripts/prerender.mjs, which serves the built site locally and
  // snapshots it. The API proxy mirrors the dev server so prerendered pages can
  // render live data (stats, featured products) instead of empty placeholders.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.PRERENDER_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.PRERENDER_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy scan attempts on sensitive files/folders to the backend for security tracking and 403 response
      '^/(\\.env|\\.git|\\.config|wp-admin|phpmyadmin|composer\\.json|package\\.json)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
