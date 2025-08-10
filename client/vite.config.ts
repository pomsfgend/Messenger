
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTTPS certificate paths (pointing to the user-provided certs in the server folder)
const certsDir = path.resolve(__dirname, '..', 'server', '.certs');
const keyPath = path.resolve(certsDir, 'acme.key');
const certPath = path.resolve(certsDir, 'acme.cer');

let httpsConfig: any = false;
try {
  if (process.env.npm_lifecycle_event?.includes('https') && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsConfig = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log(`HTTPS certificates found in ${certsDir}. Vite will run in secure mode.`);
  }
} catch (e) {
  console.warn("Could not read HTTPS certificates. Vite will run in HTTP mode.", e);
}

// DYNAMIC PROXY CONFIGURATION based on the run script
const isHttps = !!httpsConfig;
const backendProtocol = isHttps ? 'https' : 'http';
// FIX: Use 127.0.0.1 instead of localhost to prevent potential DNS/IPv6 resolution issues with the proxy in HTTPS mode.
const backendTarget = `${backendProtocol}://127.0.0.1:5173`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['react-dom', 'framer-motion', 'buffer', 'emoji-picker-react', 'react-icons/fa', 'react-window'],
  },
  server: {
    https: httpsConfig, // Use HTTPS if certs are available
    host: '0.0.0.0', // Allow access from other devices on the same network
    port: 5174, // Client runs on 5174
    allowedHosts: ['bulkhead.hopto.org', 'localhost'],
    proxy: {
      // Proxy API requests to the backend server (on port 5173)
      '/api': {
        target: backendTarget, // Dynamically set protocol
        secure: false, // Do not validate backend server's cert in this context
        changeOrigin: true,
        proxyTimeout: 5000, 
      },
      // Proxy uploaded files from the backend
      '/uploads': {
        target: backendTarget, // Dynamically set protocol
        secure: false,
        changeOrigin: true,
      },
      // Proxy assets from the server's assets directory
      '/assets': {
        target: backendTarget,
        secure: false,
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      '/socket.io': {
        target: backendTarget, 
        secure: false,
        ws: true,
        changeOrigin: true,
        // FIX: Increase the proxy timeout to prevent premature connection closure,
        // which causes the "socket ended by other party" error.
        timeout: 60000,
      },
    },
  },
})
