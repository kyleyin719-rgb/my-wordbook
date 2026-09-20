import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const appBase = '/my-wordbook/';

export default defineConfig({
  base: appBase,
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: appBase,
      scope: appBase,
      includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      },
      manifest: {
        id: appBase,
        name: '我的电子词书',
        short_name: '词书',
        description: '离线可用的个人英汉词书。',
        lang: 'zh-CN',
        start_url: `${appBase}#/words`,
        scope: appBase,
        theme_color: '#edf5fa',
        background_color: '#edf5fa',
        display: 'standalone',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
});
