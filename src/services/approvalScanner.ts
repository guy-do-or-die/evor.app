import type { Address, PublicClient } from 'viem'
import { parseAbi } from 'viem'
import type { Approval } from '../hooks/useApprovalScanner'
import { getCachedToken, setCachedToken } from '../utils/tokenCache'

// Constants
export const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3' as const
const APPROVAL_EVENT_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925' // ERC20 Approval
const APPROVAL_FOR_ALL_TOPIC = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31' // ERC721/ERC1155 ApprovalForAll
const MIN_ALLOWANCE = 100n

const ERC20_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

const NFT_ABI = parseAbi([
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
])

// ERC1155 interface ID
const ERC1155_INTERFACE_ID = '0xd9b67a26'

// Types
interface HyperSyncLog {
  address: string
  topic0?: string
  topic1?: string
  topic2?: string
  topic3?: string
  data?: string
  log_index?: number
  transaction_index?: number
  blockNumber?: number
}

interface ParsedApproval {
  token: string
  spender: string
  allowance: bigint
  tokenType: 'ERC20' | 'ERC721' | 'ERC1155'
}

// ============================================================================
// 1. HYPERSYNC QUERY - Fetch approval events
// ============================================================================

export async function fetchApprovalEvents(
  endpoint: string,
  address: Address
): Promise<HyperSyncLog[]> {
  const ownerTopic = `0x000000000000000000000000${address.slice(2).toLowerCase()}`
  
  const query = {
    from_block: 0,
    logs: [
      // ERC20 Approval events
      {
        topics: [
          [APPROVAL_EVENT_TOPIC],
          [ownerTopic],
        ],
      },
      // ERC721/ERC1155 ApprovalForAll events
      {
        topics: [
          [APPROVAL_FOR_ALL_TOPIC],
          [ownerTopic],
        ],
      }
    ],
    field_selection: {
      block: ['number'],
      log: ['address', 'topic0', 'topic1', 'topic2', 'topic3', 'data', 'log_index', 'transaction_index'],
      transaction: ['transaction_index', 'block_number'],
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })

  if (!response.ok) {
    throw new Error(`HyperSync API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Check for indexing lag
  if (data.next_block && data.archive_height) {
    const lag = data.archive_height - data.next_block
    if (lag > 1000) {
      console.warn(`⚠️ HyperSync is ${lag.toLocaleString()} blocks behind`)
    }
  }

  // Flatten logs from response
  const logs: HyperSyncLog[] = []
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      const blockNumber = item.blocks?.[0]?.number || 0
      if (item.logs && Array.isArray(item.logs)) {
        for (const log of item.logs) {
          logs.push({ ...log, blockNumber })
        }
      }
    }
  }

  return logs
}

// ============================================================================
// 2. EVENT PARSING - Parse logs into approvals
// ============================================================================

export function parseApprovalLogs(logs: HyperSyncLog[]): ParsedApproval[] {
  // Sort logs chronologically
  const sorted = [...logs].sort((a, b) => {
    const blockDiff = (a.blockNumber || 0) - (b.blockNumber || 0)
    if (blockDiff !== 0) return blockDiff
    const txDiff = (a.transaction_index || 0) - (b.transaction_index || 0)
    if (txDiff !== 0) return txDiff
    return (a.log_index || 0) - (b.log_index || 0)
  })

  // Get latest approval for each token-spender pair
  const latestMap = new Map<string, ParsedApproval>()
  
  for (const log of sorted) {
    const token = log.address
    const eventTopic = log.topic0
    
    if (!token || !eventTopic) continue
    
    // Handle ERC20 Approval events
    if (eventTopic === APPROVAL_EVENT_TOPIC) {
      const spenderTopic = log.topic2
      const allowanceHex = log.data
      
      if (!spenderTopic) continue
      
      const spender = `0x${spenderTopic.slice(26)}`
      const key = `${token}-${spender}`
      
      try {
        const allowance = allowanceHex && allowanceHex !== '0x' 
          ? BigInt(allowanceHex) 
          : 0n
        latestMap.set(key, { token, spender, allowance, tokenType: 'ERC20' })
      } catch {
        latestMap.set(key, { token, spender, allowance: 0n, tokenType: 'ERC20' })
      }
    }
    // Handle ERC721/ERC1155 ApprovalForAll events
    else if (eventTopic === APPROVAL_FOR_ALL_TOPIC) {
      const operatorTopic = log.topic2
      const dataHex = log.data
      
      if (!operatorTopic) continue
      
      const operator = `0x${operatorTopic.slice(26)}`
      const key = `${token}-${operator}`
      
      try {
        // Parse bool from data (last byte)
        const approved = dataHex && dataHex !== '0x' && dataHex !== '0x0' 
          && !dataHex.endsWith('0'.repeat(64))
        
        if (approved) {
          // Use max uint256 to represent "all NFTs" approval
          latestMap.set(key, { 
            token, 
            spender: operator, 
            allowance: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
            tokenType: 'ERC721' // Default to ERC721, we'll detect ERC1155 later if needed
          })
        } else {
          // Revoked - set to 0
          const existing = latestMap.get(key)
          if (existing) {
            latestMap.set(key, { ...existing, allowance: 0n })
          }
        }
      } catch {
        // On error, don't add this approval
      }
    }
  }

  // Filter out zero/negligible allowances for ERC20, but keep all NFT approvals
  return Array.from(latestMap.values())
    .filter(a => a.tokenType !== 'ERC20' || a.allowance >= MIN_ALLOWANCE)
}

// ============================================================================
// 3. METADATA FETCHING - Get token info with caching
// ============================================================================

export async function fetchTokenMetadata(
  tokens: string[],
  publicClient: PublicClient
): Promise<void> {
  const uncached = tokens.filter(t => !getCachedToken(t))
  if (uncached.length === 0) return

  const contracts = uncached.flatMap(token => [
    { address: token as Address, abi: ERC20_ABI, functionName: 'symbol' as const },
    { address: token as Address, abi: ERC20_ABI, functionName: 'name' as const },
    { address: token as Address, abi: ERC20_ABI, functionName: 'decimals' as const },
  ])

  // Split into chunks of 50 to avoid RPC limits
  const CHUNK_SIZE = 50
  const allResults: any[] = []
  
  for (let i = 0; i < contracts.length; i += CHUNK_SIZE) {
    const chunk = contracts.slice(i, i + CHUNK_SIZE)
    try {
      const results = await publicClient.multicall({ contracts: chunk })
      allResults.push(...results)
      
      // Log if any results failed in this chunk
      const failedInChunk = results.filter(r => r.status !== 'success').length
      if (failedInChunk > 0) {
        console.warn(`⚠️ ${failedInChunk}/${results.length} metadata calls failed in chunk ${Math.floor(i / CHUNK_SIZE) + 1}`)
      }
    } catch (error: any) {
      console.error(`❌ Metadata multicall chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed:`, error.message)
      // Add empty results so indexing doesn't break
      allResults.push(...Array(chunk.length).fill({ status: 'failure', error: error.message }))
    }
  }

  // Track failed tokens for retry
  const failedTokens: string[] = []

  // Debug: log first few results to see what we got
  console.log(`📦 Processing ${uncached.length} tokens from ${allResults.length} multicall results`)
  
  // Debug: Try a direct call to first token to see if multicall is the issue
  if (uncached.length > 0) {
    try {
      const directSymbol = await publicClient.readContract({
        address: uncached[0] as Address,
        abi: ERC20_ABI,
        functionName: 'symbol'
      })
      console.log(`   ✅ Direct call to ${uncached[0].slice(0, 10)} worked: ${directSymbol}`)
    } catch (err: any) {
      console.error(`   ❌ Direct call to ${uncached[0].slice(0, 10)} failed:`, err.message)
    }
  }
  
  uncached.forEach((token, i) => {
    const baseIndex = i * 3
    const symbolResult = allResults[baseIndex]
    const nameResult = allResults[baseIndex + 1]
    const decimalsResult = allResults[baseIndex + 2]
    
    // Debug first 3 tokens
    if (i < 3) {
      console.log(`   Token ${i} (${token.slice(0, 10)}):`, {
        symbolStatus: symbolResult?.status,
        symbolValue: symbolResult?.result,
        nameStatus: nameResult?.status,
        decimalsStatus: decimalsResult?.status
      })
    }
    
    const symbol = symbolResult?.status === 'success' 
      ? String(symbolResult.result) 
      : '???'
    const name = nameResult?.status === 'success' 
      ? String(nameResult.result) 
      : 'Unknown'
    const decimals = decimalsResult?.status === 'success' 
      ? Number(decimalsResult.result) 
      : 18
    
    setCachedToken(token, symbol, name, decimals)
    
    // Track failures with details
    if (symbol === '???') {
      failedTokens.push(token)
      if (failedTokens.length <= 5) {
        console.warn(`   Failed token ${token.slice(0, 10)}: symbol=${symbolResult?.status}, name=${nameResult?.status}, decimals=${decimalsResult?.status}`)
      }
    }
  })

  // Warn if many metadata fetches failed
  if (failedTokens.length > 0) {
    console.warn(`⚠️ Failed to fetch metadata for ${failedTokens.length}/${uncached.length} tokens`)
    console.warn(`   Failed tokens:`, failedTokens.map(t => t.slice(0, 10)).join(', '))
    if (failedTokens.length > uncached.length * 0.5) {
      console.warn('   More than 50% failed - RPC might be having issues')
      console.warn('   Recommendation: Try scanning again')
    }
  }
}

// ============================================================================
// 4. ALLOWANCE CHECKING - Get current on-chain allowances
// ============================================================================

export async function fetchCurrentAllowances(
  approvals: ParsedApproval[],
  owner: Address,
  publicClient: PublicClient
): Promise<Map<string, bigint>> {
  // Split ERC20 and NFT approvals - they need different contract calls
  const contracts = approvals.map(a => {
    if (a.tokenType === 'ERC20') {
      return {
        address: a.token as Address,
        abi: ERC20_ABI,
        functionName: 'allowance' as const,
        args: [owner, a.spender as Address],
      }
    } else {
      // ERC721/ERC1155 use isApprovedForAll
      return {
        address: a.token as Address,
        abi: NFT_ABI,
        functionName: 'isApprovedForAll' as const,
        args: [owner, a.spender as Address],
      }
    }
  })

  // Split into chunks of 50 to avoid RPC limits
  const CHUNK_SIZE = 50
  const allResults: any[] = []
  
  for (let i = 0; i < contracts.length; i += CHUNK_SIZE) {
    const chunk = contracts.slice(i, i + CHUNK_SIZE)
    
    try {
      const results = await publicClient.multicall({ contracts: chunk })
      allResults.push(...results)
    } catch (error: any) {
      // Check for rate limiting error
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        console.error('🚨 RATE LIMITED by RPC!')
        console.error('   Add VITE_ANKR_API_KEY to .env.local to avoid this')
        console.error('   Get free key at: https://www.ankr.com/rpc/')
        throw new Error('RPC rate limit exceeded. Please add VITE_ANKR_API_KEY to .env.local')
      }
      throw error
    }
  }
  
  const allowanceMap = new Map<string, bigint>()
  approvals.forEach((approval, i) => {
    const key = `${approval.token}-${approval.spender}`
    if (approval.tokenType === 'ERC20') {
      const allowance = allResults[i]?.status === 'success' 
        ? BigInt(String(allResults[i].result)) 
        : 0n
      allowanceMap.set(key, allowance)
    } else {
      // NFT approval: convert bool to 0 or max uint256
      const isApproved = allResults[i]?.status === 'success' && allResults[i].result === true
      const allowance = isApproved 
        ? BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
        : 0n
      allowanceMap.set(key, allowance)
    }
  })

  // Detect suspicious all-zero results (stale RPC)
  const allZero = Array.from(allowanceMap.values()).every(a => a === 0n)
  if (allZero && approvals.length > 5) {
    console.warn('⚠️ WARNING: All allowances returned 0!')
    console.warn('   This might indicate:')
    console.warn('   1. RPC node returning stale data')
    console.warn('   2. All approvals were actually revoked')
    console.warn('   3. RPC multicall failed silently')
    console.warn('   Recommendation: Try scanning again')
  }

  return allowanceMap
}

// ============================================================================
// 5. NFT TYPE DETECTION - Detect ERC1155 vs ERC721
// ============================================================================

export async function detectNFTTypes(
  approvals: ParsedApproval[],
  publicClient: PublicClient
): Promise<void> {
  // Get unique NFT tokens
  const nftTokens = Array.from(new Set(
    approvals.filter(a => a.tokenType !== 'ERC20').map(a => a.token)
  ))
  
  if (nftTokens.length === 0) return
  
  // Check each NFT for ERC1155 interface support
  const checks = nftTokens.map(token => ({
    address: token as Address,
    abi: NFT_ABI,
    functionName: 'supportsInterface' as const,
    args: [ERC1155_INTERFACE_ID as `0x${string}`],
  }))
  
  try {
    const results = await publicClient.multicall({ contracts: checks })
    
    // Update tokenType for ERC1155 tokens
    results.forEach((result, i) => {
      if (result.status === 'success' && result.result === true) {
        const token = nftTokens[i]
        // Update all approvals for this token
        approvals.forEach(approval => {
          if (approval.token === token) {
            approval.tokenType = 'ERC1155'
          }
        })
      }
    })
  } catch (error) {
    console.warn('Failed to detect NFT types:', error)
    // Continue without type detection - defaults to ERC721
  }
}

// ============================================================================
// 6. APPROVAL ENRICHMENT - Combine all data
// ============================================================================

export function enrichApprovals(
  parsedApprovals: ParsedApproval[],
  currentAllowances: Map<string, bigint>
): Approval[] {
  return parsedApprovals.map(parsed => {
    const key = `${parsed.token}-${parsed.spender}`
    const currentAllowance = currentAllowances.get(key) || 0n
    const metadata = getCachedToken(parsed.token)
    const isPermit2 = parsed.spender.toLowerCase() === PERMIT2_ADDRESS.toLowerCase()
    
    return {
      token: parsed.token,
      spender: parsed.spender,
      allowance: String(parsed.allowance),
      currentAllowance: String(currentAllowance),
      tokenSymbol: metadata?.symbol || '???',
      tokenName: metadata?.name || 'Unknown',
      decimals: metadata?.decimals || 18,
      isActive: currentAllowance >= MIN_ALLOWANCE,
      isPermit2,
      tokenType: parsed.tokenType,
    }
  })
}

// ============================================================================
// 6. SORTING - Prioritize by risk
// ============================================================================

export function sortApprovalsByRisk(approvals: Approval[]): Approval[] {
  return [...approvals].sort((a, b) => {
    // 1. Active Permit2 first (highest risk)
    const aPermit2Active = a.isActive && a.isPermit2
    const bPermit2Active = b.isActive && b.isPermit2
    if (aPermit2Active !== bPermit2Active) return aPermit2Active ? -1 : 1
    
    // 2. Other active approvals
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    
    // 3. Within same tier, sort by allowance
    const aVal = BigInt(a.currentAllowance || a.allowance || '0')
    const bVal = BigInt(b.currentAllowance || b.allowance || '0')
    return aVal > bVal ? -1 : 1
  })
}

// ============================================================================
// 7. STATISTICS - Calculate approval stats
// ============================================================================

export interface ApprovalStats {
  total: number
  active: number
  revoked: number
  permit2Total: number
  permit2Active: number
}

export function calculateStats(approvals: Approval[]): ApprovalStats {
  const active = approvals.filter(a => a.isActive)
  const permit2All = approvals.filter(a => a.isPermit2)
  const permit2Active = permit2All.filter(a => a.isActive)
  
  return {
    total: approvals.length,
    active: active.length,
    revoked: approvals.length - active.length,
    permit2Total: permit2All.length,
    permit2Active: permit2Active.length,
  }
}
