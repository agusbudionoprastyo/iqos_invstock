import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'IQOS Inventory Management',
        short_name: 'IQOS Inventory',
        description: 'Sistem manajemen inventori IQOS dengan fitur audit stok, penjualan, dan laporan',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ],
        shortcuts: [
          {
            name: 'Stock Audit',
            short_name: 'Audit',
            description: 'Mulai audit stok',
            url: '/?action=audit',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Sales Report',
            short_name: 'Sales',
            description: 'Lihat laporan penjualan',
            url: '/export?type=sales',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ]
      }
    }),
    {
      name: 'copy-redirects',
      writeBundle() {
        try {
          copyFileSync('public/_redirects', 'dist/_redirects')
          copyFileSync('public/.htaccess', 'dist/.htaccess')
        } catch (err) {
          console.log('No redirect files found in public folder')
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  }
})
