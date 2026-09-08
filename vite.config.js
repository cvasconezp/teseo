import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // three.js (~500KB) en su propio chunk de vendor: se cachea aparte del
        // código de la app, así una actualización del código no obliga a
        // volver a descargar el motor 3D.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
