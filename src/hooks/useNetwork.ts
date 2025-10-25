import { useState, useEffect } from 'react'
import { 
  mainnet, sepolia,
  base, baseSepolia, 
  optimism, optimismSepolia, 
  arbitrum, arbitrumSepolia,
  polygon, polygonAmoy,
  bsc, bscTestnet,
  type Chain 
} from 'viem/chains'

export type SupportedChain = 
  | 'mainnet' | 'sepolia'
  | 'base' | 'base-sepolia'
  | 'optimism' | 'optimism-sepolia'
  | 'arbitrum' | 'arbitrum-sepolia'
  | 'polygon' | 'polygon-amoy'
  | 'bsc' | 'bsc-testnet'

interface ChainConfig {
  chain: Chain
  hypersyncPath: string
  category: 'mainnet' | 'testnet'
  scanningSupported: boolean
}

// Get HyperSync endpoint based on environment
export function getHypersyncEndpoint(chainKey: SupportedChain): string {
  // In production, use serverless function to hide token
  if (import.meta.env.PROD) {
    return `/api/hypersync?chain=${chainKey.replace('-sepolia', '-sepolia').replace('mainnet', 'eth')}`
  }
  
  // In dev, use Vite proxy (token in .env.local is OK for dev)
  return CHAIN_CONFIGS[chainKey].hypersyncPath
}

export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  // Mainnets
  'mainnet': {
    chain: mainnet,
    hypersyncPath: '/hypersync/eth/query',
    category: 'mainnet',
    scanningSupported: true
  },
  'base': {
    chain: base,
    hypersyncPath: '/hypersync/base/query',
    category: 'mainnet',
    scanningSupported: true
  },
  'optimism': {
    chain: optimism,
    hypersyncPath: '/hypersync/optimism/query',
    category: 'mainnet',
    scanningSupported: true
  },
  'arbitrum': {
    chain: arbitrum,
    hypersyncPath: '/hypersync/arbitrum/query',
    category: 'mainnet',
    scanningSupported: true
  },
  'polygon': {
    chain: polygon,
    hypersyncPath: '/hypersync/polygon/query',
    category: 'mainnet',
    scanningSupported: true
  },
  'bsc': {
    chain: bsc,
    hypersyncPath: '/hypersync/bsc/query',
    category: 'mainnet',
    scanningSupported: true
  },
  
  // Testnets
  'sepolia': {
    chain: sepolia,
    hypersyncPath: '/hypersync/sepolia/query',
    category: 'testnet',
    scanningSupported: true
  },
  'base-sepolia': {
    chain: baseSepolia,
    hypersyncPath: '/hypersync/base-sepolia/query',
    category: 'testnet',
    scanningSupported: false // HyperSync doesn't support base-sepolia yet
  },
  'optimism-sepolia': {
    chain: optimismSepolia,
    hypersyncPath: '/hypersync/optimism-sepolia/query',
    category: 'testnet',
    scanningSupported: true
  },
  'arbitrum-sepolia': {
    chain: arbitrumSepolia,
    hypersyncPath: '/hypersync/arbitrum-sepolia/query',
    category: 'testnet',
    scanningSupported: true
  },
  'polygon-amoy': {
    chain: polygonAmoy,
    hypersyncPath: '/hypersync/polygon-amoy/query',
    category: 'testnet',
    scanningSupported: true
  },
  'bsc-testnet': {
    chain: bscTestnet,
    hypersyncPath: '/hypersync/bsc-testnet/query',
    category: 'testnet',
    scanningSupported: true
  }
}

// Helper to get chain properties
export const getChainConfig = (chainKey: SupportedChain) => {
  const config = CHAIN_CONFIGS[chainKey]
  const chain = config.chain
  return {
    id: chainKey,
    name: chain.name,
    chainId: chain.id,
    chainIdHex: `0x${chain.id.toString(16)}`,
    rpcUrl: chain.rpcUrls.default.http[0],
    explorer: chain.blockExplorers?.default.url || '',
    hypersyncPath: config.hypersyncPath
  }
}

export function useNetwork() {
  const [currentChainId, setCurrentChainId] = useState<string>('')
  const [selectedChain, setSelectedChain] = useState<SupportedChain>('base-sepolia')
  const [wrongNetwork, setWrongNetwork] = useState(false)

  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        setCurrentChainId(chainId)
        
        const validChainIds = Object.keys(CHAIN_CONFIGS).map(k => getChainConfig(k as SupportedChain).chainIdHex)
        setWrongNetwork(!validChainIds.includes(chainId))
        
        // Auto-select matching chain
        const matchingChain = Object.keys(CHAIN_CONFIGS).find(
          (key) => getChainConfig(key as SupportedChain).chainIdHex === chainId
        )
        if (matchingChain) {
          setSelectedChain(matchingChain as SupportedChain)
        }
      }
    }
    
    checkNetwork()
    
    if (window.ethereum) {
      const handleChainChanged = (chainId: string) => {
        setCurrentChainId(chainId)
        const validChainIds = Object.keys(CHAIN_CONFIGS).map(k => getChainConfig(k as SupportedChain).chainIdHex)
        setWrongNetwork(!validChainIds.includes(chainId))
        
        const matchingChain = Object.keys(CHAIN_CONFIGS).find(
          (key) => getChainConfig(key as SupportedChain).chainIdHex === chainId
        )
        if (matchingChain) {
          setSelectedChain(matchingChain as SupportedChain)
        }
      }
      
      window.ethereum.on('chainChanged', handleChainChanged)
      return () => window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const switchChain = async (chain: SupportedChain) => {
    const config = getChainConfig(chain)
    try {
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainIdHex }],
      })
      setSelectedChain(chain)
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum?.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.chainIdHex,
            chainName: config.name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.explorer],
          }],
        })
        setSelectedChain(chain)
      }
    }
  }

  return {
    currentChainId,
    selectedChain,
    wrongNetwork,
    chainConfig: getChainConfig(selectedChain),
    switchChain,
    setSelectedChain
  }
}
