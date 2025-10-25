import { useState, useCallback, useRef } from 'react'
import { createPublicClient, http, type Address } from 'viem'
import type { SupportedChain } from './useNetwork'
import { CHAIN_CONFIGS, getHypersyncEndpoint } from './useNetwork'
import {
  fetchApprovalEvents,
  parseApprovalLogs,
  fetchTokenMetadata,
  fetchCurrentAllowances,
  detectNFTTypes,
  enrichApprovals,
  sortApprovalsByRisk,
  calculateStats,
} from '../services/approvalScanner'
import { getCachedToken, clearTokenCache } from '../utils/tokenCache'
import { scanDebugger } from '../utils/scanDebugger'

export type TokenType = 'ERC20' | 'ERC721' | 'ERC1155'

export interface Approval {
  token: string
  spender: string
  allowance: string
  tokenSymbol?: string
  tokenName?: string
  decimals?: number
  currentAllowance?: string
  isActive?: boolean
  isPermit2?: boolean
  tokenType: TokenType
}

export function useApprovalScanner() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scanningRef = useRef<string | null>(null) // Track current scan to prevent duplicates
  const lastChainRef = useRef<SupportedChain | null>(null) // Track chain changes

  const scanApprovals = useCallback(async (
    address: Address | undefined,
    chain: SupportedChain
  ) => {
    // Early validation - don't start scan if conditions aren't met
    if (!address) {
      console.log('⏭️ Skipping scan: No address')
      return
    }
    
    const chainConfig = CHAIN_CONFIGS[chain]
    if (!chainConfig.scanningSupported) {
      console.log('⏭️ Skipping scan: Chain not supported', chain)
      setError(`Scanning not supported on ${chainConfig.chain.name}`)
      return
    }
    
    // Detect chain change and clear token cache
    if (lastChainRef.current && lastChainRef.current !== chain) {
      console.log(`🔄 Chain changed: ${lastChainRef.current} → ${chain}`)
      console.log('   Clearing token cache...')
      clearTokenCache()
    }
    lastChainRef.current = chain

    // Prevent duplicate scans
    const scanKey = `${address}-${chain}`
    if (scanningRef.current === scanKey) {
      console.log('⏭️ Already scanning', scanKey)
      return
    }

    // Initialize scan with debugging
    const scanId = scanDebugger.startScan(address, chain)
    scanningRef.current = scanKey
    setScanning(true)
    setError(null)

    try {
      scanDebugger.log('START', { address, chain })
      scanDebugger.log('VALIDATE_CHAIN', { chain, supported: true })

      // Create publicClient with multichain RPC support
      // Supports Ankr (multichain), Infura (multichain), or per-chain URLs
      const getRpcUrls = (chain: SupportedChain): string[] => {
        const urls: string[] = []
        
        // Option 1: Ankr API - single key works for all chains!
        // Requires whitelisted domain (use ngrok for local dev)
        const ankrKey = import.meta.env.VITE_ANKR_API_KEY
        if (ankrKey) {
          const ankrChainMap: Record<string, string> = {
            'mainnet': 'eth',
            'base': 'base',
            'optimism': 'optimism',
            'arbitrum': 'arbitrum',
            'polygon': 'polygon',
            'bsc': 'bsc',
            'sepolia': 'eth_sepolia',
            'base-sepolia': 'base_sepolia',
            'optimism-sepolia': 'optimism_sepolia',
            'arbitrum-sepolia': 'arbitrum_sepolia',
            'polygon-amoy': 'polygon_amoy',
            'bsc-testnet': 'bsc_testnet'
          }
          const ankrChain = ankrChainMap[chain]
          if (ankrChain) {
            urls.push(`https://rpc.ankr.com/${ankrChain}/${ankrKey}`)
          }
        }
        
        // Option 2: Infura multichain API
        const infuraKey = import.meta.env.VITE_INFURA_API_KEY
        if (infuraKey) {
          const infuraChainMap: Record<string, string> = {
            'mainnet': 'mainnet', 'base': 'base-mainnet', 'optimism': 'optimism-mainnet',
            'arbitrum': 'arbitrum-mainnet', 'polygon': 'polygon-mainnet',
            'sepolia': 'sepolia'
          }
          const infuraChain = infuraChainMap[chain]
          if (infuraChain) urls.push(`https://${infuraChain}.infura.io/v3/${infuraKey}`)
        }
        
        // Option 3: Per-chain custom URLs (legacy support)
        const perChainUrls: Record<SupportedChain, string | undefined> = {
          'mainnet': import.meta.env.VITE_ETH_RPC_URL,
          'base': import.meta.env.VITE_BASE_RPC_URL,
          'optimism': import.meta.env.VITE_OPTIMISM_RPC_URL,
          'arbitrum': import.meta.env.VITE_ARBITRUM_RPC_URL,
          'polygon': import.meta.env.VITE_POLYGON_RPC_URL,
          'bsc': import.meta.env.VITE_BSC_RPC_URL,
          'sepolia': import.meta.env.VITE_SEPOLIA_RPC_URL,
          'base-sepolia': import.meta.env.VITE_BASE_SEPOLIA_RPC_URL,
          'optimism-sepolia': import.meta.env.VITE_OPTIMISM_SEPOLIA_RPC_URL,
          'arbitrum-sepolia': import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC_URL,
          'polygon-amoy': import.meta.env.VITE_POLYGON_AMOY_RPC_URL,
          'bsc-testnet': import.meta.env.VITE_BSC_TESTNET_RPC_URL,
        }
        if (perChainUrls[chain]) urls.push(perChainUrls[chain]!)
        
        return urls
      }

      const customRpcs = getRpcUrls(chain)
      
      // Create publicClient with fallback transports
      // Viem will try each RPC in order until one works
      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: customRpcs.length > 0 
          ? http(customRpcs[0], { retryCount: 1, timeout: 10_000 })
          : http() // Use viem's default public RPCs
      })
      
      scanDebugger.log('CREATE_CLIENT', {
        chainId: chainConfig.chain.id,
        chainName: chainConfig.chain.name,
        usingCustomRpc: customRpcs.length > 0,
        rpcProvider: customRpcs.length > 0 
          ? (customRpcs[0].includes('ankr') ? 'Ankr' : customRpcs[0].includes('infura') ? 'Infura' : 'Custom')
          : 'Public RPC'
      })

      // 2. Fetch approval events from HyperSync
      const endpoint = getHypersyncEndpoint(chain)
      scanDebugger.log('FETCH_EVENTS_START', { endpoint })
      
      const logs = await fetchApprovalEvents(endpoint, address)
      
      scanDebugger.log('FETCH_EVENTS_END', { 
        logCount: logs.length,
        sampleLogs: logs.slice(0, 3)
      })

      // 3. Parse logs into unique approvals
      const parsedApprovals = parseApprovalLogs(logs)
      
      scanDebugger.log('PARSE_LOGS', {
        totalLogs: logs.length,
        uniqueApprovals: parsedApprovals.length,
        sample: parsedApprovals.slice(0, 3).map(a => ({
          token: a.token.slice(0, 10),
          spender: a.spender.slice(0, 10),
          allowance: String(a.allowance)
        }))
      })

      if (parsedApprovals.length === 0) {
        scanDebugger.endScan(scanId, { total: 0, active: 0, revoked: 0 })
        setApprovals([])
        return
      }

      // 4. Fetch token metadata (with caching)
      const uniqueTokens = Array.from(new Set(parsedApprovals.map(a => a.token)))
      const cachedCount = uniqueTokens.filter(t => getCachedToken(t)).length
      
      scanDebugger.log('FETCH_METADATA_START', { 
        uniqueTokens: uniqueTokens.length,
        cached: cachedCount,
        toFetch: uniqueTokens.length - cachedCount,
        chunked: uniqueTokens.length - cachedCount > 16 // 50 calls / 3 per token
      })
      
      await fetchTokenMetadata(uniqueTokens, publicClient)
      
      scanDebugger.log('FETCH_METADATA_END', { 
        note: 'Multicalls split into chunks of 50 to avoid RPC limits' 
      })

      // 5. Detect NFT types (ERC721 vs ERC1155)
      scanDebugger.log('DETECT_NFT_TYPES_START', {
        nftTokens: parsedApprovals.filter(a => a.tokenType !== 'ERC20').length
      })
      
      await detectNFTTypes(parsedApprovals, publicClient)
      
      scanDebugger.log('DETECT_NFT_TYPES_END', {
        erc721Count: parsedApprovals.filter(a => a.tokenType === 'ERC721').length,
        erc1155Count: parsedApprovals.filter(a => a.tokenType === 'ERC1155').length,
      })

      // 7. Check current on-chain allowances
      scanDebugger.log('FETCH_ALLOWANCES_START', {
        approvalsToCheck: parsedApprovals.length
      })
      
      const currentAllowances = await fetchCurrentAllowances(parsedApprovals, address, publicClient)
      
      scanDebugger.log('FETCH_ALLOWANCES_END', {
        allowanceCount: currentAllowances.size,
        sampleAllowances: Array.from(currentAllowances.entries()).slice(0, 3).map(([key, val]) => ({
          key,
          allowance: String(val)
        }))
      })

      // 8. Enrich with metadata and current state
      const enriched = enrichApprovals(parsedApprovals, currentAllowances)
      
      scanDebugger.log('ENRICH', {
        enrichedCount: enriched.length,
        sample: enriched.slice(0, 3).map(a => ({
          token: a.token.slice(0, 10),
          symbol: a.tokenSymbol,
          currentAllowance: a.currentAllowance,
          isActive: a.isActive,
          isPermit2: a.isPermit2
        }))
      })

      // 7. Sort by risk priority
      const sorted = sortApprovalsByRisk(enriched)
      
      scanDebugger.log('SORT', {
        sortedCount: sorted.length,
        top3: sorted.slice(0, 3).map(a => ({
          symbol: a.tokenSymbol,
          isActive: a.isActive,
          isPermit2: a.isPermit2
        }))
      })

      // 8. Filter to only active approvals
      const activeOnly = sorted.filter(a => a.isActive)
      
      scanDebugger.log('FILTER', {
        total: sorted.length,
        active: activeOnly.length,
        filtered: sorted.length - activeOnly.length
      })

      // 9. Calculate and log stats
      const stats = calculateStats(sorted)
      
      scanDebugger.endScan(scanId, {
        total: stats.total,
        active: stats.active,
        revoked: stats.revoked
      })
      
      console.log(`   🟢 Active: ${stats.active} | ⚪ Revoked: ${stats.revoked}`)
      console.log(`   🟠 Permit2: ${stats.permit2Total} (${stats.permit2Active} active)`)
      
      if (stats.permit2Active > 0) {
        console.warn(`   🚨 ${stats.permit2Active} ACTIVE PERMIT2 = HIGH RISK`)
      }

      // Show sample of active approvals only
      if (activeOnly.length > 0) {
        console.log('\n📋 Active Approvals:')
        activeOnly.slice(0, 5).forEach((a, i) => {
          const badge = a.isPermit2 ? '🟠 PERMIT2' : '🔴 ACTIVE'
          console.log(`   ${i + 1}. ${badge} ${a.tokenSymbol} → ${a.spender.slice(0, 10)}...`)
        })
      } else {
        console.log('\n✅ No active approvals found!')
      }

      setApprovals(activeOnly)
    } catch (err: any) {
      scanDebugger.error(scanId, err)
      setError(err.message || 'Scan failed')
      setApprovals([])
    } finally {
      setScanning(false)
      scanningRef.current = null
    }
  }, []) // No dependencies - publicClient is created per-scan

  return {
    approvals,
    scanning,
    error,
    scanApprovals,
    setApprovals
  }
}
