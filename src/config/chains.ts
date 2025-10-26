import { 
  mainnet, sepolia,
  base, baseSepolia, 
  optimism, optimismSepolia, 
  arbitrum, arbitrumSepolia,
  polygon, polygonAmoy,
  bsc, bscTestnet,
  type Chain 
} from 'viem/chains'

export interface ChainConfig {
  chain: Chain
  key: string
  category: 'mainnet' | 'testnet'
  scanningSupported: boolean
}

// Centralized chain configuration - single source of truth
export const SUPPORTED_CHAINS: ChainConfig[] = [
  // Mainnets
  { chain: mainnet, key: 'mainnet', category: 'mainnet', scanningSupported: true },
  { chain: base, key: 'base', category: 'mainnet', scanningSupported: true },
  { chain: optimism, key: 'optimism', category: 'mainnet', scanningSupported: true },
  { chain: arbitrum, key: 'arbitrum', category: 'mainnet', scanningSupported: true },
  { chain: polygon, key: 'polygon', category: 'mainnet', scanningSupported: true },
  { chain: bsc, key: 'bsc', category: 'mainnet', scanningSupported: true },
  
  // Testnets
  { chain: sepolia, key: 'sepolia', category: 'testnet', scanningSupported: true },
  { chain: baseSepolia, key: 'base-sepolia', category: 'testnet', scanningSupported: true },
  { chain: optimismSepolia, key: 'optimism-sepolia', category: 'testnet', scanningSupported: true },
  { chain: arbitrumSepolia, key: 'arbitrum-sepolia', category: 'testnet', scanningSupported: true },
  { chain: polygonAmoy, key: 'polygon-amoy', category: 'testnet', scanningSupported: true },
  { chain: bscTestnet, key: 'bsc-testnet', category: 'testnet', scanningSupported: true },
]

// Type for chain keys
export type SupportedChainKey = typeof SUPPORTED_CHAINS[number]['key']

// Helper: Get config by key
export const getChainConfig = (key: SupportedChainKey): ChainConfig => {
  const config = SUPPORTED_CHAINS.find(c => c.key === key)
  if (!config) throw new Error(`Unsupported chain: ${key}`)
  return config
}

// Helper: Get config by chain ID
export const getChainConfigById = (chainId: number): ChainConfig | undefined => {
  return SUPPORTED_CHAINS.find(c => c.chain.id === chainId)
}

// Helper: Get HyperSync endpoint for a chain
export const getHypersyncEndpoint = (key: SupportedChainKey, isDev: boolean): string => {
  // const config = getChainConfig(key) // Not needed for endpoint generation
  
  // In production, use serverless function
  if (!isDev) {
    const hypersyncKey = key === 'mainnet' ? 'eth' : key
    return `/api/hypersync?chain=${hypersyncKey}`
  }
  
  // In dev, use Vite proxy with chain ID
  return `/hypersync/${key}/query`
}

// Export map for Vite proxy configuration
export const HYPERSYNC_PROXY_MAP = Object.fromEntries(
  SUPPORTED_CHAINS.map(({ key, chain }) => [key, chain.id.toString()])
)
