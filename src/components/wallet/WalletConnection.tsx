import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import type { SupportedChain } from '../../hooks/useNetwork'
import { ChainSelector } from './ChainSelector'
import { formatAddress, getExplorerUrl, copyToClipboard } from '../../utils/address'

interface WalletConnectionProps {
  selectedChain?: SupportedChain
  onChainChange?: (chain: SupportedChain) => void
  wrongNetwork?: boolean
}

export function WalletConnection({ selectedChain, onChainChange, wrongNetwork }: WalletConnectionProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = async () => {
    if (!address) return
    const success = await copyToClipboard(address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isConnected) {
    return (
      <Card className="p-4 sm:p-6 glass-glow-blue">
        <div className="text-center space-y-4">
          <Wallet className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-sm sm:text-base text-muted-foreground">Connect your wallet to scan approvals</p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            {connectors.map((connector) => (
              <Button
                key={connector.id}
                onClick={() => connect({ connector })}
                className="w-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 hover:border-blue-400/50"
                size="lg"
              >
                {connector.name}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-3 sm:p-4 glass-glow-blue">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Address - compact on mobile */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Connected</p>
          <div className="flex items-center gap-1">
            {/* Address as explorer link */}
            {selectedChain && getExplorerUrl(address || '', selectedChain) ? (
              <a
                href={getExplorerUrl(address || '', selectedChain)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                title="View on block explorer"
              >
                {formatAddress(address || '', 6, 4)}
              </a>
            ) : (
              <span className="font-mono text-xs sm:text-sm text-muted-foreground truncate">
                {formatAddress(address || '', 6, 4)}
              </span>
            )}
            
            {/* Copy button */}
            <button
              onClick={handleCopyAddress}
              className="shrink-0 p-0.5 hover:bg-accent rounded transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        
        {/* Chain Selector */}
        {selectedChain && onChainChange && (
          <>
            <ChainSelector
              selectedChain={selectedChain}
              onChainChange={onChainChange}
            />
            
            {/* Disconnect Button */}
            <Button
              onClick={() => disconnect()}
              variant="secondary"
              size="sm"
              className="shrink-0 p-2 sm:px-3"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
      
      {wrongNetwork && (
        <p className="text-yellow-500 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
          <span>⚠️</span>
          <span>Please switch to the selected network in your wallet</span>
        </p>
      )}
    </Card>
  )
}
