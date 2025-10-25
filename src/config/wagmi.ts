import { http, createConfig } from 'wagmi'
import { 
  mainnet, sepolia,
  base, baseSepolia,
  optimism, optimismSepolia,
  arbitrum, arbitrumSepolia,
  polygon, polygonAmoy,
  bsc, bscTestnet
} from 'wagmi/chains'
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors'

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
    metaMask(),
    coinbaseWallet({ appName: 'evor.app' }),
    injected(),
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
