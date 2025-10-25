import { useState, useEffect } from 'react'
import { type Chain } from 'viem/chains'
import { 
  SUPPORTED_CHAINS, 
  getChainConfig as getCentralChainConfig, 
  getChainConfigById,
  getHypersyncEndpoint as getHypersyncEndpointHelper,
  type SupportedChainKey 
} from '../config/chains'

export type SupportedChain = SupportedChainKey

interface ChainConfig {
  chain: Chain
  hypersyncPath: string
  category: 'mainnet' | 'testnet'
  scanningSupported: boolean
}

// Get HyperSync endpoint based on environment
export function getHypersyncEndpoint(chainKey: SupportedChain): string {
  return getHypersyncEndpointHelper(chainKey, import.meta.env.DEV)
}

// Convert centralized config to legacy format for compatibility
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = Object.fromEntries(
  SUPPORTED_CHAINS.map(({ key, chain, category, scanningSupported }) => [
    key,
    {
      chain,
      hypersyncPath: `/hypersync/${key}/query`,
      category,
      scanningSupported
    }
  ])
) as Record<SupportedChain, ChainConfig>

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
        
        // Auto-select matching chain using centralized config
        const chainIdNum = parseInt(chainId, 16)
        const config = getChainConfigById(chainIdNum)
        if (config) {
          setSelectedChain(config.key as SupportedChain)
        }
      }
    }
    
    checkNetwork()
    
    if (window.ethereum) {
      const handleChainChanged = (chainId: string) => {
        setCurrentChainId(chainId)
        const validChainIds = Object.keys(CHAIN_CONFIGS).map(k => getChainConfig(k as SupportedChain).chainIdHex)
        setWrongNetwork(!validChainIds.includes(chainId))
        
        // Auto-select matching chain using centralized config
        const chainIdNum = parseInt(chainId, 16)
        const config = getChainConfigById(chainIdNum)
        if (config) {
          setSelectedChain(config.key as SupportedChain)
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

  const chainConfig = getChainConfig(selectedChain)

  return {
    currentChainId,
    selectedChain,
    wrongNetwork,
    chainConfig,
    switchChain,
    setSelectedChain
  }
}
