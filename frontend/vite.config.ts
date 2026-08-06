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

    /**
     * Lighthouse flags large minified bundles with no source map. `hidden` emits
     * the .map files without appending the //# sourceMappingURL comment, so the
     * maps are available for debugging but browsers do not fetch them for
     * ordinary visitors — no cost on the critical path.
     */
    sourcemap: 'hidden',

    /**
     * Everything used to land in one 5.4 MB (1.4 MB gzip) chunk that the public
     * landing page had to download and parse before it could render — Lighthouse
     * reported 1,038 KiB of it unused and 2.0 s of JS execution.
     *
     * These libraries are only reachable from authenticated dashboards, so
     * splitting them out lets the browser fetch them in parallel and cache them
     * independently of the app code that changes on every deploy.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Session replay: admin inspector + the guest tracker. Very large.
          'vendor-rrweb': ['rrweb'],
          // Face matching for identity verification — ML models, never on landing.
          'vendor-faceapi': ['face-api.js'],
          // Spreadsheet + PDF export, dashboards only.
          'vendor-export': ['xlsx', 'jspdf', 'jspdf-autotable', 'pdf-lib'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
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
