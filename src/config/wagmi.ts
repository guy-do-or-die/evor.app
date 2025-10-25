import { http, createConfig } from 'wagmi'
import { 
  mainnet, sepolia,
  base, baseSepolia,
  optimism, optimismSepolia,
  arbitrum, arbitrumSepolia,
  polygon, polygonAmoy,
  bsc, bscTestnet
} from 'wagmi/chains'
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors'

// Get WalletConnect project ID from https://cloud.reown.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

if (!projectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID is not set. Get one at https://cloud.reown.com')
}

export const config = createConfig({
  chains: [
    mainnet, sepolia,
    base, baseSepolia,
    optimism, optimismSepolia,
    arbitrum, arbitrumSepolia,
    polygon, polygonAmoy,
    bsc, bscTestnet
  ],
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: 'Evorapp',
        description: 'Evaporate all approvals in one click',
        url: 'https://evor.app',
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
      }
    }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Evorapp',
      appLogoUrl: 'https://avatars.githubusercontent.com/u/37784886'
    }),
  ],
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_ETH_RPC_URL),
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL),
    [optimism.id]: http(import.meta.env.VITE_OPTIMISM_RPC_URL),
    [optimismSepolia.id]: http(import.meta.env.VITE_OPTIMISM_SEPOLIA_RPC_URL),
    [arbitrum.id]: http(import.meta.env.VITE_ARBITRUM_RPC_URL),
    [arbitrumSepolia.id]: http(import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC_URL),
    [polygon.id]: http(import.meta.env.VITE_POLYGON_RPC_URL),
    [polygonAmoy.id]: http(import.meta.env.VITE_POLYGON_AMOY_RPC_URL),
    [bsc.id]: http(import.meta.env.VITE_BSC_RPC_URL),
    [bscTestnet.id]: http(import.meta.env.VITE_BSC_TESTNET_RPC_URL),
  },
})
