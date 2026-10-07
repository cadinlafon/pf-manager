import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // The PF Audio App uses Vite's default 5173 — keep PF Management on its own port.
    port: 5280,
    strictPort: false,
  },
  build: {
    // The Firebase SDK chunk alone is ~530 kB minified (~157 kB gzipped).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Firebase is most of the bundle — keep it in its own cacheable chunk.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'PF Management',
        short_name: 'PF Management',
        description: 'Palouse Fellowship Management',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#fdf8f3',
        theme_color: '#3d2200',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
