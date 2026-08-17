import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// When building for GitHub Pages the app lives at /<repo-name>/
// In dev it runs at root (proxy to local BFF on :4000)
const isProd = process.env.NODE_ENV === 'production'
const base = process.env.VITE_BASE ?? (isProd ? '/mordren-loikmon/' : '/')

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Rolldown in Vite 6+/7 expects manualChunks to be a function when
        // running the experimental rolldown bundler. Object form is not accepted.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (['vue', 'vue-router', 'pinia'].some((m) => id.includes(m))) return 'vendor'
            if (id.includes('vue-i18n')) return 'i18n'
            if (id.includes('axios')) return 'http'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
