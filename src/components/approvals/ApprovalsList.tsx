import { forwardRef } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { Card } from '../ui/card'
import type { Approval } from '../../hooks/useApprovalScanner'
import type { SupportedChain } from '../../hooks/useNetwork'
import { ApprovalCard } from './ApprovalCard'

interface ApprovalsListProps {
  approvals: Approval[]
  onRemove?: (index: number) => void
  scanning?: boolean
  snapping?: boolean
  selectedChain?: SupportedChain
}

export const ApprovalsList = forwardRef<HTMLDivElement, ApprovalsListProps>(
  ({ approvals, onRemove, scanning, snapping, selectedChain }, ref) => {
    if (scanning) {
      return (
        <Card className="p-6 sm:p-8 glass-glow-cyan">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
            <p className="text-sm text-muted-foreground">Scanning approvals...</p>
          </div>
        </Card>
      )
    }

    if (approvals.length === 0) {
      return (
        <Card className="p-6 sm:p-8 glass-glow-green">
          <div className="text-center space-y-2">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400" />
            <p className="text-sm sm:text-base font-medium">No active approvals found!</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Your wallet is clean.</p>
          </div>
        </Card>
      )
    }

    return (
      <div ref={ref} className={`snap-particles-container space-y-2 ${snapping ? 'snapping' : ''}`}>
        {approvals.map((approval, index) => (
          <ApprovalCard
            key={`${approval.token}-${approval.spender}`}
            approval={approval}
            index={index}
            onRemove={onRemove ? () => onRemove(index) : undefined}
            showRemove={approvals.length > 1}
            selectedChain={selectedChain}
          />
        ))}
      </div>
    )
  }
)

ApprovalsList.displayName = 'ApprovalsList'
