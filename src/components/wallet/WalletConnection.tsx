import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Wallet, LogOut } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import type { SupportedChain } from '../../hooks/useNetwork'
import { ChainSelector } from './ChainSelector'

interface WalletConnectionProps {
  selectedChain?: SupportedChain
  onChainChange?: (chain: SupportedChain) => void
  wrongNetwork?: boolean
}

export function WalletConnection({ selectedChain, onChainChange, wrongNetwork }: WalletConnectionProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Connected</p>
          <p className="font-mono text-xs sm:text-sm truncate">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
        </div>
        
        {selectedChain && onChainChange && (
          <div className="flex items-center gap-2 sm:gap-3">
            <ChainSelector
              selectedChain={selectedChain}
              onChainChange={onChainChange}
            />
            
            <Button
              onClick={() => disconnect()}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Disconnect</span>
            </Button>
          </div>
        )}
      </div>
      
      {wrongNetwork && (
        <p className="text-yellow-500 text-xs mt-2 flex items-center gap-1">
          <span>⚠️</span>
          <span>Please switch to the selected network in your wallet</span>
        </p>
      )}
    </Card>
  )
}
