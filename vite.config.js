import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The API (server/) runs separately; proxying /api keeps the browser on one origin, so no CORS
const apiProxy = { '/api': 'http://localhost:3001' }

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'HIIPS360',
        short_name: 'HIIPS360',
        description: 'Prototype: WorkSafeBC hazard identification inspection protocol sheets on your phone.',
        start_url: '/home',
        scope: '/',
        display: 'standalone',
        theme_color: '#ed8b00',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Leaves out the search model's .wasm files: 14-28 MB each, over Workbox's limit, which fails the build
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: '/index.html',
        // Never answer API calls with the app shell
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
