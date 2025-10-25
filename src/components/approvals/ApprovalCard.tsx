import { useState } from 'react'
import { Copy, Check, X, Infinity } from 'lucide-react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import type { Approval } from '../../hooks/useApprovalScanner'

interface ApprovalCardProps {
  approval: Approval
  index?: number
  onRemove?: () => void
  showRemove?: boolean
}

export function ApprovalCard({ approval, index = 0, onRemove, showRemove }: ApprovalCardProps) {
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
  
  const isUnlimited = BigInt(approval.allowance || '0') > BigInt('1000000000000000000000000000')
  
  const formatAllowance = () => {
    if (isUnlimited) return null // Will render icon instead
    const decimals = approval.decimals || 18
    const amount = Number(approval.allowance) / Math.pow(10, decimals)
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2, notation: 'compact' })
  }

  const ellipseAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (text: string, type: 'token' | 'spender') => {
    await navigator.clipboard.writeText(text)
    if (type === 'token') {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    } else {
      setCopiedSpender(true)
      setTimeout(() => setCopiedSpender(false), 2000)
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
          {/* Token Address */}
          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
            {ellipseAddress(approval.token)}
          </span>
          <Button
            onClick={() => copyToClipboard(approval.token, 'token')}
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            title="Copy token address"
          >
            {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>

          {/* Spender Address */}
          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
            {ellipseAddress(approval.spender)}
          </span>
          <Button
            onClick={() => copyToClipboard(approval.spender, 'spender')}
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
