import { useState, useEffect, useRef } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseAbi, type Address, hexToSignature, createWalletClient, custom } from 'viem'
import { Thanos } from 'vanish-effect'
import { ExternalLink, ShieldX, ChevronUp, ChevronDown } from 'lucide-react'
import EvorappLogo from './components/EvorappLogo'
import { WalletConnection } from './components/wallet/WalletConnection'
import { ApprovalsList } from './components/approvals/ApprovalsList'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Checkbox } from './components/ui/checkbox'
import { useNetwork, CHAIN_CONFIGS } from './hooks/useNetwork'
import { useApprovalScanner } from './hooks/useApprovalScanner'
import './components/SnapEnhance.css'

const EVOR_DELEGATE = '0x430cae04bdfc596be0ca98b46279c3babf080620' as const

function App() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  const { selectedChain, wrongNetwork, chainConfig, switchChain, setSelectedChain } = useNetwork()
  const { approvals, scanning, scanApprovals, setApprovals, error: scanError } = useApprovalScanner()
  
  const [status, setStatus] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearDelegationAfter, setClearDelegationAfter] = useState(true)
  const [enableSupport, setEnableSupport] = useState(true)
  const [ethSupport, setEthSupport] = useState('0.0001')
  const [snapEffect, setSnapEffect] = useState(false)
  const approvalsRef = useRef<HTMLDivElement>(null)

  // Auto-scan on wallet connection, network change, or manual chain selection
  useEffect(() => {
    if (isConnected && address && !wrongNetwork) {
      scanApprovals(address, selectedChain)
    }
  }, [isConnected, address, selectedChain, wrongNetwork, scanApprovals])

  const handleChainChange = async (chain: typeof selectedChain) => {
    setSelectedChain(chain)
    await switchChain(chain)
  }

  const revokeApprovals = async () => {
    if (!isConnected || !address || !window.ethereum) {
      setStatus('❌ Please connect your wallet first')
      return
    }
    
    if (approvals.length === 0) {
      setStatus('❌ No approvals to revoke')
      return
    }
    
    setLoading(true)
    setStatus('Signing EIP-7702 authorization...')
    setTxHash('')
    
    try {
      const nonce = await publicClient!.getTransactionCount({ address })
      
      // Create EIP-7702 authorization
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Authorization: [
            { name: 'chainId', type: 'uint256' },
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint64' },
          ],
        },
        primaryType: 'Authorization' as const,
        domain: {
          name: 'EIP-7702',
          version: '1',
          chainId: chainConfig.chainId,
        },
        message: {
          chainId: chainConfig.chainId,
          address: EVOR_DELEGATE,
          nonce: Number(nonce),
        },
      }
      
      setStatus('Please sign the authorization...')
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })
      
      const sig = hexToSignature(signature)
      const authorization = {
        chainId: chainConfig.chainId,
        address: EVOR_DELEGATE,
        nonce,
        ...sig,
      }
      
      setStatus('Sending revoke transaction...')
      
      const client = createWalletClient({
        chain: CHAIN_CONFIGS[selectedChain].chain,
        transport: custom(window.ethereum),
      })
      
      const evorAbi = parseAbi([
        'function revokeERC20(address[] tokens, address[] spenders) external',
      ])
      
      const tokens = approvals.map(p => p.token as Address)
      const spenders = approvals.map(p => p.spender as Address)
      
      const hash = await client.writeContract({
        account: address,
        abi: evorAbi,
        address: address,
        authorizationList: [authorization],
        functionName: 'revokeERC20',
        args: [tokens, spenders],
      })
      
      setTxHash(hash)
      setStatus('Waiting for confirmation...')
      
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted')
        }
        
        const revokedCount = approvals.length
        
        // Trigger snap effect
        if (approvalsRef.current) {
          setSnapEffect(true)
          
          Thanos.snap(approvalsRef.current, {
            duration: 2,
            randomness: 0.9,
            particleDensity: 5,
            onComplete: () => {
              setSnapEffect(false)
              setApprovals([])
            }
          })
        }
        
        setStatus(`✅ Revoked ${revokedCount} approvals! Cleaning up...`)
        
        // Clear delegation
        if (clearDelegationAfter) {
          try {
            await clearDelegation(client, address, chainConfig.chainId)
            setStatus(`✅ Revoked ${revokedCount} approvals and cleared delegation!`)
          } catch (clearError: any) {
            console.warn('Failed to clear delegation:', clearError)
            setStatus(`✅ Revoked ${revokedCount} approvals!`)
          }
        } else {
          setStatus(`✅ Revoked ${revokedCount} approvals!`)
        }
        
        // Re-scan after a delay
        setTimeout(() => {
          if (address) scanApprovals(address, selectedChain)
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error revoking:', error)
      setStatus(`❌ ${error.shortMessage || error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const clearDelegation = async (client: any, address: Address, chainId: number) => {
    const nonce = await publicClient!.getTransactionCount({ address })
    
    const clearTypedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Authorization: [
          { name: 'chainId', type: 'uint256' },
          { name: 'address', type: 'address' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
      primaryType: 'Authorization' as const,
      domain: {
        name: 'EIP-7702',
        version: '1',
        chainId,
      },
      message: {
        chainId,
        address: '0x0000000000000000000000000000000000000000',
        nonce: Number(nonce),
      },
    }
    
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(clearTypedData)],
    })
    
    const sig = hexToSignature(signature)
    const clearAuthorization = {
      chainId,
      address: '0x0000000000000000000000000000000000000000' as Address,
      nonce,
      ...sig,
    }
    
    const clearHash = await client.sendTransaction({
      account: address,
      to: address,
      value: 0n,
      authorizationList: [clearAuthorization],
    })
    
    await publicClient!.waitForTransactionReceipt({ hash: clearHash })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-12 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <EvorappLogo size="lg" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Evor-porate all approvals in one click 
          </p>
        </div>

        {/* Wallet & Network */}
        <div className="mb-4 sm:mb-6">
          <WalletConnection
            selectedChain={isConnected ? selectedChain : undefined}
            onChainChange={isConnected ? handleChainChange : undefined}
            wrongNetwork={isConnected ? wrongNetwork : undefined}
          />
        </div>

        {/* Notification Area - Always visible to prevent layout shifts */}
        {isConnected && !wrongNetwork && (
          <Card className="mb-4 p-3 bg-muted/30 min-h-[60px] flex flex-col justify-center">
            {scanError ? (
              <p className="text-xs sm:text-sm text-yellow-500">⚠️ {scanError}</p>
            ) : status ? (
              <p className={`text-xs sm:text-sm ${txHash ? 'mb-2' : ''}`}>{status}</p>
            ) : (
              <p className="text-xs text-muted-foreground/50">Ready to revoke approvals</p>
            )}
            {txHash && (
              <a
                href={`${chainConfig.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono text-xs break-all flex items-center gap-1"
              >
                <span>{txHash}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </Card>
        )}

        {isConnected && !wrongNetwork && (
          <>
            {/* Approvals Section */}
            <Card className="p-4 sm:p-6 glass-glow-purple">
              {approvals.length > 0 && (
                <div className="space-y-3 mb-4">
                  {/* Revoke Button - Prominent at Top */}
                  <Button
                    onClick={revokeApprovals}
                    disabled={loading}
                    variant="destructive"
                    size="lg"
                    className="w-full h-12 text-base font-semibold border-2 border-destructive/20 shadow-lg"
                  >
                    <ShieldX className="w-5 h-5" />
                    Revoke {approvals.length} Approval{approvals.length !== 1 ? 's' : ''}
                  </Button>

                  {/* Settings */}
                  <Card className="p-3 bg-muted/50">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="clearDelegation"
                          checked={clearDelegationAfter}
                          onChange={(e) => setClearDelegationAfter(e.target.checked)}
                        />
                        <label htmlFor="clearDelegation" className="text-xs sm:text-sm cursor-pointer">
                          Clear delegation after revocation
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="enableSupport"
                          checked={enableSupport}
                          onChange={(e) => setEnableSupport(e.target.checked)}
                        />
                        <label htmlFor="enableSupport" className="text-xs sm:text-sm cursor-pointer">
                          Support the project:
                        </label>
                        
                        {enableSupport && (
                          <div className="relative inline-flex items-center h-7">
                            <input
                              type="text"
                              value={ethSupport}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setEthSupport(val)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault()
                                  const current = parseFloat(ethSupport) || 0
                                  setEthSupport((current + 0.0001).toFixed(4))
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault()
                                  const current = parseFloat(ethSupport) || 0
                                  setEthSupport(Math.max(0, current - 0.0001).toFixed(4))
                                }
                              }}
                              onBlur={() => {
                                const num = parseFloat(ethSupport)
                                if (isNaN(num) || num < 0) {
                                  setEthSupport('0.0001')
                                } else {
                                  setEthSupport(num.toFixed(4))
                                }
                              }}
                              className="h-7 w-[90px] rounded-md border border-input bg-background pl-2 pr-[38px] text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="absolute right-[17px] flex items-center gap-1 pointer-events-none">
                              <span className="text-[11px] text-muted-foreground font-medium">ETH</span>
                            </div>
                            <div className="absolute right-0 top-0 flex flex-col h-7 pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseFloat(ethSupport) || 0
                                  setEthSupport((current + 0.0001).toFixed(4))
                                }}
                                className="h-[14px] w-[14px] flex items-center justify-center border border-input border-b-0 rounded-tr-md bg-background hover:bg-accent/50 transition-colors"
                              >
                                <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseFloat(ethSupport) || 0
                                  setEthSupport(Math.max(0, current - 0.0001).toFixed(4))
                                }}
                                className="h-[14px] w-[14px] flex items-center justify-center border border-input rounded-br-md bg-background hover:bg-accent/50 transition-colors"
                              >
                                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              <ApprovalsList
                ref={approvalsRef}
                approvals={approvals}
                scanning={scanning}
                snapping={snapEffect}
                onRemove={(index) => setApprovals(approvals.filter((_, i) => i !== index))}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default App
