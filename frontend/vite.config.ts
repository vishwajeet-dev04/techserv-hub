import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Keep the browser's Host header so Django builds file URLs that work from other machines on the LAN.
const backendProxy = {
  target: 'http://localhost:8082',
  changeOrigin: false,
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': backendProxy,
      '/media': backendProxy,
    },
  },
})
