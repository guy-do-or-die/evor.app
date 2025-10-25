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
    watch: {
      ignored: ['**/node_modules/**']
    },
    proxy: {
      // Ankr RPC proxy to bypass CORS
      '/ankr-rpc': {
        target: 'https://rpc.ankr.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace('/ankr-rpc', ''),
        configure: (proxy: any) => {
          proxy.on('error', (err: any, _req: any, res: any) => {
            console.error('Ankr proxy error:', err);
            res.writeHead(500, {
              'Content-Type': 'text/plain',
            });
            res.end('Ankr proxy error');
          });
        },
      },
      // HyperSync proxies
      ...Object.fromEntries(
        ['eth', 'base', 'optimism', 'arbitrum', 'polygon', 'bsc',
         'sepolia', 'base-sepolia', 'optimism-sepolia', 'arbitrum-sepolia', 'polygon-amoy', 'bsc-testnet'
        ].map(chain => [
          `/hypersync/${chain}`,
          {
            target: `https://${chain}.hypersync.xyz`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(`/hypersync/${chain}`, ''),
            configure: (proxy: any) => {
              proxy.on('error', (err: any, _req: any, res: any) => {
                console.error('Proxy error:', err);
                res.writeHead(500, {
                  'Content-Type': 'text/plain',
                });
                res.end('Proxy error');
              });
            },
          }
        ])
      )
    },
  },
})
