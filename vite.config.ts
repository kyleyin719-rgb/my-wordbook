import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '我的词书 · Lexuni',
        short_name: '我的词书',
        description: '离线可用的个人英汉词书。',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        theme_color: '#edf5fa',
        background_color: '#edf5fa',
        display: 'standalone',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});
