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
  logoUrl: string
}

// Centralized chain configuration - single source of truth
export const SUPPORTED_CHAINS: ChainConfig[] = [
  // Mainnets - using icons.llamao.fi which supports CORS
  { chain: mainnet, key: 'mainnet', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg' },
  { chain: base, key: 'base', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg' },
  { chain: optimism, key: 'optimism', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg' },
  { chain: arbitrum, key: 'arbitrum', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg' },
  { chain: polygon, key: 'polygon', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg' },
  { chain: bsc, key: 'bsc', category: 'mainnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_binance.jpg' },
  
  // Testnets
  { chain: sepolia, key: 'sepolia', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg' },
  { chain: baseSepolia, key: 'base-sepolia', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg' },
  { chain: optimismSepolia, key: 'optimism-sepolia', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg' },
  { chain: arbitrumSepolia, key: 'arbitrum-sepolia', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg' },
  { chain: polygonAmoy, key: 'polygon-amoy', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg' },
  { chain: bscTestnet, key: 'bsc-testnet', category: 'testnet', scanningSupported: true, logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_binance.jpg' },
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
