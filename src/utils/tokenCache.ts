// Simple in-memory cache for token metadata
interface TokenMetadata {
  symbol: string
  name: string
  decimals: number
  timestamp: number
}

const tokenCache = new Map<string, TokenMetadata>()
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

export function getCachedToken(address: string): TokenMetadata | null {
  const cached = tokenCache.get(address.toLowerCase())
  if (!cached) return null
  
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION
  if (isExpired) {
    tokenCache.delete(address.toLowerCase())
    return null
  }
  
  return cached
}

export function setCachedToken(
  address: string,
  symbol: string,
  name: string,
  decimals: number
) {
  tokenCache.set(address.toLowerCase(), {
    symbol,
    name,
    decimals,
    timestamp: Date.now()
  })
}

export function clearTokenCache() {
  tokenCache.clear()
}
