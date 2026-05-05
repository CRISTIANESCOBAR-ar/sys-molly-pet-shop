import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const buildCacheId = `molly-${Date.now()}`

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'Molly Petshop',
        short_name: 'Molly',
        description: 'Sistema de gestión - Molly Petshop',
        theme_color: '#62ef4f',
        background_color: '#62ef4f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cada build genera un nuevo SW que reemplaza el anterior inmediatamente
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        cacheId: buildCacheId,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Firestore usa streams de larga duración (Listen/channel).
            // Workbox NO debe cachear esas respuestas — el SDK de Firebase
            // ya maneja offline via IndexedDB. NetworkOnly evita interferir.
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
