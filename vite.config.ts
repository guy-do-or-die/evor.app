import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Make vanish-effect use html2canvas-pro which supports oklch colors
      'html2canvas': 'html2canvas-pro',
    },
  },
  server: {
    proxy: {
      '/hypersync/base-sepolia': {
        target: 'https://base-sepolia.hypersync.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hypersync\/base-sepolia/, ''),
      },
      '/hypersync/base': {
        target: 'https://base.hypersync.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hypersync\/base/, ''),
      },
    },
  },
})
