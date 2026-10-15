import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/agoratap/', // GitHub Pages path. Kept so the deployed URL does not change.
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Agora Pay',
        short_name: 'Agora Pay',
        description: 'Early pilot. Any-in → any-out. Pay in anything you hold, including USDT on any chain and XMR via a swap route. Merchants receive any asset on any chain the swap route supports; EU merchants exclude only USDT (ESMA) and privacy coins like XMR (AMLR), non-EU merchants are unrestricted. Fiat bank payout via licensed partner is coming.',
        theme_color: '#123b2e',
        background_color: '#f3f1e8',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'],
  }
})
