import { useState, useEffect, useRef } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { parseAbi, type Address, hexToSignature, createWalletClient, custom } from 'viem'
import { Thanos } from 'vanish-effect'
import { ExternalLink, Sparkles, RefreshCw } from 'lucide-react'
import EvorappLogo from './components/EvorappLogo'
import { WalletConnection } from './components/wallet/WalletConnection'
import { ApprovalsList } from './components/approvals/ApprovalsList'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Checkbox } from './components/ui/checkbox'
import { useNetwork, CHAIN_CONFIGS } from './hooks/useNetwork'
import { useApprovalScanner } from './hooks/useApprovalScanner'
import './components/SnapEnhance.css'

// EvorDelegate addresses per network
const EVOR_DELEGATES = {
  8453: '0xbdf5ec7f3d3bbe67bc5fe8232c495a5159df87bc', // Base Mainnet (old - needs redeployment)
  84532: '0x81bacfd7401e69328c0aa6501757e5e4137f0b14', // Base Sepolia (PRODUCTION - clean)
  11155111: '0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23', // Ethereum Sepolia (PRODUCTION - clean)
} as const

function App() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  const { selectedChain, wrongNetwork, chainConfig, switchChain, setSelectedChain } = useNetwork()
  const { approvals, scanning, scanApprovals, setApprovals, error: scanError } = useApprovalScanner()
  
  const [status, setStatus] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearDelegationAfter, setClearDelegationAfter] = useState(true)
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
    
    // Check wallet compatibility
    const isMetaMask = window.ethereum?.isMetaMask && !window.ethereum?.isRabby
    
    if (isMetaMask) {
      setStatus('⚠️ MetaMask has limited EIP-7702 support. For best experience, use Rabby wallet.')
      // Add small delay so users can see the warning
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    setLoading(true)
    setStatus('Checking delegation status...')
    setTxHash('')
    
    try {
      // Get the correct EvorDelegate address for this network
      const evorDelegate = EVOR_DELEGATES[chainConfig.chainId as keyof typeof EVOR_DELEGATES]
      if (!evorDelegate) {
        throw new Error(`EvorDelegate not deployed on chain ${chainConfig.chainId}`)
      }

      // Check if EOA is already delegated to the correct contract
      const existingCode = await publicClient!.getCode({ address })
      const expectedCode = await publicClient!.getCode({ address: evorDelegate })
      const alreadyDelegated = existingCode === expectedCode && existingCode !== undefined && existingCode !== '0x'
      
      let authorization
      
      if (!alreadyDelegated) {
        // Need to create new EIP-7702 authorization
        setStatus('Signing EIP-7702 authorization...')
        
        const nonce = await publicClient!.getTransactionCount({ address })
        
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
            address: evorDelegate,
            nonce: Number(nonce),
          },
        }
        
        setStatus('Please sign the authorization...')
        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(typedData)],
        })
        
        const sig = hexToSignature(signature)
        authorization = {
          chainId: chainConfig.chainId,
          address: evorDelegate,
          nonce: Number(nonce),
          ...sig,
        }
      } else {
        setStatus('✅ Already delegated, skipping authorization...')
      }
      
      setStatus('Sending revoke transaction...')
      
      const client = createWalletClient({
        chain: CHAIN_CONFIGS[selectedChain].chain,
        transport: custom(window.ethereum),
      })
      
      // Separate ERC20 and NFT approvals
      const erc20Approvals = approvals.filter(a => a.tokenType === 'ERC20')
      const nftApprovals = approvals.filter(a => a.tokenType === 'ERC721' || a.tokenType === 'ERC1155')
      
      const evorAbi = parseAbi([
        'function revokeERC20(address[] tokens, address[] spenders) external',
        'function revokeForAll(address[] collections, address[] operators) external',
        'function revokeAll(address[] tokens, address[] spenders, address[] collections, address[] operators) external',
      ])
      
      let hash: Address
      
      // Prepare arrays
      const tokens = erc20Approvals.map(p => p.token as Address)
      const spenders = erc20Approvals.map(p => p.spender as Address)
      const collections = nftApprovals.map(p => p.token as Address)
      const operators = nftApprovals.map(p => p.spender as Address)
      
      // Determine which function to call based on approval types
      let functionName: 'revokeAll' | 'revokeERC20' | 'revokeForAll'
      let args: Address[][]
      let statusText: string
      
      if (erc20Approvals.length > 0 && nftApprovals.length > 0) {
        // Both types - use revokeAll for maximum efficiency!
        functionName = 'revokeAll'
        args = [tokens, spenders, collections, operators]
        statusText = `Sign to revoke ${approvals.length} approvals in one transaction!`
      } else if (erc20Approvals.length > 0) {
        // Only ERC20
        functionName = 'revokeERC20'
        args = [tokens, spenders]
        statusText = `Sign to revoke ${erc20Approvals.length} token approvals`
      } else {
        // Only NFTs
        functionName = 'revokeForAll'
        args = [collections, operators]
        statusText = `Sign to revoke ${nftApprovals.length} NFT approvals`
      }
      
      setStatus(`⚠️ ${statusText}`)
      
      // Debug logging
      console.log('Transaction params:', {
        functionName,
        args,
        erc20Count: erc20Approvals.length,
        nftCount: nftApprovals.length,
        alreadyDelegated: !authorization,
      })
      
      hash = await client.writeContract({
        account: address,
        abi: evorAbi,
        address: address,
        ...(authorization && { authorizationList: [authorization] }),
        functionName,
        args,
      } as any)
      
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
            direction: 'up',
            randomness: 0.3,
            particleDensity: 10,
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
      
      // Try to extract more detailed error info
      let errorMsg = error.shortMessage || error.message || 'Unknown error'
      
      if (error.cause?.reason) {
        errorMsg = error.cause.reason
      } else if (error.cause?.data?.message) {
        errorMsg = error.cause.data.message
      } else if (error.details) {
        errorMsg = error.details
      }
      
      console.error('Detailed error:', {
        message: error.message,
        shortMessage: error.shortMessage,
        details: error.details,
        cause: error.cause,
        data: error.data,
      })
      
      setStatus(`❌ ${errorMsg}`)
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
    
    if (!window.ethereum) {
      throw new Error('No wallet detected')
    }
    
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(clearTypedData)],
    })
    
    const sig = hexToSignature(signature)
    const clearAuthorization = {
      chainId,
      address: '0x0000000000000000000000000000000000000000' as Address,
      nonce: Number(nonce),
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
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center items-center mb-4 sm:mb-6">
            <div className="scale-[0.6] sm:scale-90 md:scale-100 lg:scale-110 origin-center">
              <EvorappLogo size="lg" />
            </div>
          </div>
          <p className="text-sm sm:text-base md:text-lg font-medium bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 text-transparent bg-clip-text animate-glow-subtle">
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
          <Card className="mb-4 p-3 bg-muted/30 min-h-[60px] flex items-center justify-between gap-3">
            <div className="flex-1">
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
            </div>
            <Button
              onClick={() => address && scanApprovals(address, selectedChain)}
              disabled={scanning}
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              title="Rescan approvals"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            </Button>
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
                    variant="default"
                    size="lg"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-br from-cyan-400/30 to-emerald-400/30 backdrop-blur-xl border-2 border-cyan-300/80 shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:shadow-[0_0_60px_rgba(34,211,238,0.7)] hover:border-cyan-200 transition-all text-white font-bold"
                  >
                    <Sparkles className="w-5 h-5" />
                    Revoke {approvals.length} Approval{approvals.length !== 1 ? 's' : ''}
                  </Button>

                  {/* Settings */}
                  <Card className="p-3 bg-muted/50">
                    <div className="flex flex-col md:flex-row flex-wrap gap-x-6 gap-y-2.5 md:justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-3">
                        <Checkbox
                          id="clearDelegation"
                          checked={clearDelegationAfter}
                          onChange={(e) => setClearDelegationAfter(e.target.checked)}
                        />
                        <label htmlFor="clearDelegation" className="text-xs sm:text-sm cursor-pointer">
                          Clear delegation after revocation
                        </label>
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
                selectedChain={selectedChain}
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
