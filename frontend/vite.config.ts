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
        /**
         * Written as a function rather than the object form on purpose.
         *
         * The object form gave Rollup no home for Vite's `__vitePreload` helper,
         * and it parked it inside `vendor-export`. That made the 1.35 MB
         * spreadsheet/PDF chunk a *static* import of the entry — every visitor
         * downloaded xlsx and jspdf to get a few lines of preload glue, even
         * after both libraries were moved behind dynamic imports.
         *
         * A function is only consulted for real modules, so the helper and
         * anything else virtual stays in the entry chunk where it belongs.
         */
        manualChunks(id: string) {
          // Pinned explicitly. Left to Rollup this lands in whichever vendor
          // chunk it feels like — it chose `vendor-export`, which is what made
          // 1.35 MB of xlsx/jspdf a static import of the entry. `vendor-react`
          // is already statically loaded on every page, so the helper is free
          // there.
          if (id.includes('preload-helper')) return 'vendor-react';
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router-dom)\//.test(id)) return 'vendor-react';
          // Session replay: admin inspector + the guest tracker. Very large.
          if (/node_modules\/rrweb\//.test(id)) return 'vendor-rrweb';
          // Face matching for identity verification — ML models, never on landing.
          if (/node_modules\/face-api\.js\//.test(id)) return 'vendor-faceapi';
          // Spreadsheet + PDF export. Loaded on demand from the export buttons.
          if (/node_modules\/(xlsx|jspdf|jspdf-autotable|pdf-lib)\//.test(id)) return 'vendor-export';
          if (/node_modules\/recharts\//.test(id)) return 'vendor-charts';
          if (/node_modules\/framer-motion\//.test(id)) return 'vendor-motion';
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
