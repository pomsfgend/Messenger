
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },
  server: {
    port: 5173, // Explicitly set the port for clarity
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy uploaded files from the backend
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      '/socket.io': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
})
