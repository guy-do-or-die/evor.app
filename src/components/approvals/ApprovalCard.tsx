import { useState } from 'react'
import { Copy, Check, X, Infinity } from 'lucide-react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import type { Approval } from '../../hooks/useApprovalScanner'
import type { SupportedChain } from '../../hooks/useNetwork'
import { formatAddress, getExplorerUrl, copyToClipboard } from '../../utils/address'

interface ApprovalCardProps {
  approval: Approval
  index?: number
  onRemove?: () => void
  showRemove?: boolean
  selectedChain?: SupportedChain
}

export function ApprovalCard({ approval, index = 0, onRemove, showRemove, selectedChain }: ApprovalCardProps) {
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedSpender, setCopiedSpender] = useState(false)
  
  // Cycle through all logo colors based on index
  const getGradientClass = (idx: number) => {
    const colors = [
      'glass-glow-red',    // red
      'glass-glow-orange', // orange
      'glass-glow-amber',  // amber
      'glass-glow-green',  // green
      'glass-glow-cyan',   // cyan
      'glass-glow-blue',   // blue
      'glass-glow-purple'  // purple
    ]
    return colors[idx % colors.length]
  }
  
  // NFT approvals (ApprovalForAll) should always show infinity
  const isNFTApproval = approval.tokenType === 'ERC721' || approval.tokenType === 'ERC1155'
  // Use currentAllowance (actual on-chain state) not allowance (event data)
  const isUnlimited = isNFTApproval || BigInt(approval.currentAllowance || '0') > BigInt('1000000000000000000000000000')
  
  const formatAllowance = () => {
    if (isUnlimited) return null // Will render icon instead
    const decimals = approval.decimals || 18
    // Use currentAllowance for display (actual on-chain state)
    const amount = Number(approval.currentAllowance) / Math.pow(10, decimals)
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2, notation: 'compact' })
  }

  const handleCopy = async (text: string, type: 'token' | 'spender') => {
    const success = await copyToClipboard(text)
    if (success) {
      if (type === 'token') {
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2000)
      } else {
        setCopiedSpender(true)
        setTimeout(() => setCopiedSpender(false), 2000)
      }
    }
  }

  return (
    <Card className={`p-2.5 sm:p-3 ${getGradientClass(index)} ${
      !approval.isActive 
        ? 'opacity-50 grayscale-[0.3]' 
        : approval.isPermit2 
          ? 'ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20' 
          : 'ring-1 ring-white/10'
    }`}>
      <div className="flex items-center justify-between gap-2">
        {/* Amount and Token */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isUnlimited ? (
            <div className="inline-flex items-center">
              <Infinity className={`w-5 h-5 sm:w-6 sm:h-6 ${approval.isActive ? 'text-white' : 'text-muted-foreground'}`} strokeWidth={2.5} />
            </div>
          ) : (
            <span className={`text-base sm:text-lg font-bold truncate ${approval.isActive ? 'text-white' : 'text-muted-foreground'}`}>
              {formatAllowance()}
            </span>
          )}
          <span className="text-sm sm:text-base font-semibold text-muted-foreground shrink-0">
            {approval.tokenSymbol || (approval.tokenType !== 'ERC20' ? 'NFT' : '???')}
          </span>
          {approval.isPermit2 && approval.isActive ? (
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-orange-500/30 text-orange-300 shrink-0 font-bold animate-pulse border border-orange-500/50">
              PERMIT2
            </span>
          ) : (
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
              approval.tokenType === 'ERC20' 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : approval.tokenType === 'ERC721'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
            }`}>
              {approval.tokenType}
            </span>
          )}
        </div>

        {/* Addresses and Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Token Address - link to explorer */}
          {selectedChain && getExplorerUrl(approval.token, selectedChain) ? (
            <a
              href={getExplorerUrl(approval.token, selectedChain)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
              title="View token on explorer"
            >
              {formatAddress(approval.token)}
            </a>
          ) : (
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
              {formatAddress(approval.token)}
            </span>
          )}
          <Button
            onClick={() => handleCopy(approval.token, 'token')}
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            title="Copy token address"
          >
            {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>

          {/* Spender Address - link to explorer */}
          {selectedChain && getExplorerUrl(approval.spender, selectedChain) ? (
            <a
              href={getExplorerUrl(approval.spender, selectedChain)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
              title="View spender on explorer"
            >
              {formatAddress(approval.spender)}
            </a>
          ) : (
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
              {formatAddress(approval.spender)}
            </span>
          )}
          <Button
            onClick={() => handleCopy(approval.spender, 'spender')}
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            title="Copy spender address"
          >
            {copiedSpender ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>

          {/* Remove Button */}
          {showRemove && onRemove && (
            <Button
              onClick={onRemove}
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
