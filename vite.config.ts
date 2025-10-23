import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
