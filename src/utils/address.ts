import type { SupportedChain } from '../hooks/useNetwork'
import { getChainConfig } from '../hooks/useNetwork'

/**
 * Format address to short format (0x1234...5678)
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return ''
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Get block explorer URL for an address on a specific chain
 */
export function getExplorerUrl(address: string, chain: SupportedChain): string {
  const config = getChainConfig(chain)
  
  if (!config.explorer) {
    // Fallback if no explorer configured
    return ''
  }
  
  return `${config.explorer}/address/${address}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}
