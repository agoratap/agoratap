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
        description: 'Early pilot. Any-in → any-out. For an EU leg, preferred payout assets are USDC, EURC, BTC, and ETH. USDT is not an EU merchant payout.',
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
