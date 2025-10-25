import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { HYPERSYNC_PROXY_MAP } from './src/config/chains'

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
    host: true, // Allow external connections
    allowedHosts: [
      'localhost',
      '.ngrok-free.app', // Allow all ngrok domains
      '.ngrok.io',
    ],
    watch: {
      ignored: ['**/node_modules/**']
    },
    proxy: Object.fromEntries(
      // Sort by key length DESC so 'base-sepolia' matches before 'base'
      Object.entries(HYPERSYNC_PROXY_MAP)
        .sort((a, b) => b[0].length - a[0].length)
        .map(([chain, chainId]) => [
        `/hypersync/${chain}`,
        {
          target: `https://${chainId}.hypersync.xyz`,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(`/hypersync/${chain}`, ''),
          configure: (proxy: any) => {
            proxy.on('error', (err: any, _req: any, res: any) => {
              console.error(`Proxy error for ${chain}:`, err.message);
              res.writeHead(500, {
                'Content-Type': 'text/plain',
              });
              res.end('Proxy error');
            });
          },
        }
      ])
    ),
  },
})
