import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stock Management & Alert System',
        short_name: 'StockAlert',
        description: 'Vaccine stock management for EPI facilities',
        theme_color: '#006241',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // xlsx, jspdf, html2canvas are only needed on Export — keep them out of the
        // install-time precache (saves ~1.1 MB for field workers on slow connections).
        // sw.js adds a CacheFirst runtime route so they still work offline after first use.
        globIgnores: ['**/xlsx-*.js', '**/jspdf*.js', '**/html2canvas*.js'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-dom/client'],
          'vendor-router': ['react-router-dom'],
          'vendor-query':  ['@tanstack/react-query'],
          'vendor-icons':  ['lucide-react'],
        },
      },
    },
  },
})
