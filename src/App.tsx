import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWalletClient, usePublicClient } from 'wagmi'
import { parseAbi, type Address, hexToSignature, createWalletClient, custom } from 'viem'
import { baseSepolia } from 'wagmi/chains'
import EvorappLogo from './components/EvorappLogo'

declare global {
  interface Window {
    ethereum?: any
  }
}

const EVOR_DELEGATE = '0x430cae04bdfc596be0ca98b46279c3babf080620' as const

function App() {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: walletClient } = useWalletClient({ account: address })
  const publicClient = usePublicClient()
  
  useEffect(() => {
    console.log('Wallet state:', { isConnected, address, hasWalletClient: !!walletClient, connector: connector?.name })
  }, [isConnected, address, walletClient, connector])

  const [approvalPairs, setApprovalPairs] = useState<Array<{ token: string; spender: string; allowance?: string }>>([])
  const [status, setStatus] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [currentChainId, setCurrentChainId] = useState<string>('')
  
  // Check network on connect
  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum && isConnected) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        setCurrentChainId(chainId)
        // Allow both Base mainnet (0x2105) and Base Sepolia (0x14a34)
        setWrongNetwork(chainId !== '0x14a34' && chainId !== '0x2105')
      }
    }
    checkNetwork()
    
    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId: string) => {
        setCurrentChainId(chainId)
        setWrongNetwork(chainId !== '0x14a34' && chainId !== '0x2105')
      })
    }
  }, [isConnected])

  const scanApprovals = async () => {
    if (!address || !publicClient) return
    
    setScanning(true)
    setStatus('Scanning for approvals with HyperSync...')
    
    try {
      // Get current chain ID directly from wallet to ensure it's up to date
      const chainId = window.ethereum ? await window.ethereum.request({ method: 'eth_chainId' }) : currentChainId
      
      console.log('Current chain ID:', chainId, 'State chain ID:', currentChainId)
      
      // Determine network and HyperSync endpoint
      const isMainnet = chainId === '0x2105'
      const networkName = isMainnet ? 'Base Mainnet' : 'Base Sepolia'
      const hypersyncPath = isMainnet ? '/hypersync/base/query' : '/hypersync/base-sepolia/query'
      
      console.log(`Querying HyperSync REST API for ${networkName}...`)
      console.log(`Using endpoint: ${hypersyncPath}`)
      
      // ERC20 Approval event signature
      const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      // Owner address as topic (32 bytes with padding)
      const ownerTopic = `0x000000000000000000000000${address.slice(2).toLowerCase()}`
      
      // Query HyperSync REST API
      const query = {
        from_block: 0,
        logs: [{
          topics: [
            [approvalTopic], // topic0: Approval event signature
            [ownerTopic],    // topic1: owner address (indexed)
          ],
        }],
        field_selection: {
          block: ['number'],
          log: ['address', 'topic0', 'topic1', 'topic2', 'topic3', 'data', 'log_index', 'transaction_index'],
          transaction: ['transaction_index', 'block_number'],
        },
      }
      
      console.log(`🔍 Scanning ${networkName} for approvals...`)
      setStatus(`Querying HyperSync on ${networkName}...`)
      
      const url = hypersyncPath
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_HYPERSYNC_TOKEN}`,
      }
      const body = JSON.stringify(query)
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ HyperSync API error:', response.status, errorText)
        throw new Error(`HyperSync API error: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      
      // Flatten logs from all blocks and track block number for sorting
      const allLogs: any[] = []
      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          // HyperSync returns { logs: [...], blocks: [{number: ...}] }
          const blockNumber = item.blocks && item.blocks[0] ? item.blocks[0].number : 0
          
          if (item.logs && Array.isArray(item.logs)) {
            // Add block info to each log
            for (const log of item.logs) {
              allLogs.push({
                ...log,
                blockNumber,
              })
            }
          }
        }
      }
      
      // Sort logs chronologically to get the most recent approval for each pair
      allLogs.sort((a, b) => {
        const blockDiff = (a.blockNumber || 0) - (b.blockNumber || 0)
        if (blockDiff !== 0) return blockDiff
        
        const txDiff = (a.transaction_index || 0) - (b.transaction_index || 0)
        if (txDiff !== 0) return txDiff
        
        return (a.log_index || 0) - (b.log_index || 0)
      })
      
      console.log(`📝 Processing ${allLogs.length} approval events...`)
      
      // Parse token/spender pairs and get the MOST RECENT allowance from event data
      const latestApprovals = new Map<string, { token: string; spender: string; allowance: bigint }>()
      
      for (const log of allLogs) {
        const tokenAddress = log.address
        const spenderTopic = log.topic2
        const allowanceHex = log.data
        
        if (tokenAddress && spenderTopic) {
          const spender = `0x${spenderTopic.slice(26)}` // Remove padding
          const key = `${tokenAddress}-${spender}`
          
          try {
            // Decode the allowance from hex (empty = 0 = revoked)
            const allowance = allowanceHex && allowanceHex !== '0x' ? BigInt(allowanceHex) : 0n
            // Store the latest approval (we're iterating chronologically)
            latestApprovals.set(key, { token: tokenAddress, spender, allowance })
          } catch (error) {
            // If parsing fails, treat as 0 allowance (revoked)
            latestApprovals.set(key, { token: tokenAddress, spender, allowance: 0n })
          }
        }
      }
      setStatus(`Processing ${latestApprovals.size} approvals...`)
      
      // Filter to only active approvals (allowance > 0)
      // Note: We explicitly exclude 0 allowances (revoked approvals)
      // Also filter out dust approvals (< 100 wei which are likely errors/spam)
      const activeApprovals: Array<{ token: string; spender: string; allowance: string }> = []
      let skippedCount = 0
      const MIN_ALLOWANCE = 100n // Minimum 100 wei to be considered active
      
      for (const [, approval] of latestApprovals) {
        // Only include if allowance is explicitly greater than dust threshold
        if (approval.allowance >= MIN_ALLOWANCE) {
          activeApprovals.push({
            token: approval.token,
            spender: approval.spender,
            allowance: approval.allowance.toString(),
          })
        } else {
          skippedCount++
        }
      }
      
      console.log(`📊 Found ${activeApprovals.length} active approvals, skipped ${skippedCount} (revoked/dust)`)
      
      // Fetch token symbols and decimals for better UX
      setStatus(`Fetching token info for ${activeApprovals.length} tokens...`)
      const erc20Abi = parseAbi([
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)',
      ])
      
      const approvalsWithMetadata = await Promise.all(
        activeApprovals.map(async (approval) => {
          try {
            const [symbol, name, decimals] = await Promise.all([
              publicClient.readContract({
                address: approval.token as Address,
                abi: erc20Abi,
                functionName: 'symbol',
              }).catch(() => '???'),
              publicClient.readContract({
                address: approval.token as Address,
                abi: erc20Abi,
                functionName: 'name',
              }).catch(() => 'Unknown Token'),
              publicClient.readContract({
                address: approval.token as Address,
                abi: erc20Abi,
                functionName: 'decimals',
              }).catch(() => 18), // Default to 18 if call fails
            ])
            
            return {
              ...approval,
              tokenSymbol: symbol,
              tokenName: name,
              decimals: Number(decimals),
            }
          } catch (error) {
            return {
              ...approval,
              tokenSymbol: '???',
              tokenName: 'Unknown Token',
              decimals: 18,
            }
          }
        })
      )
      
      setApprovalPairs(approvalsWithMetadata)
      
      if (activeApprovals.length > 0) {
        const totalTokens = activeApprovals.reduce((sum, approval) => {
          const amount = BigInt(approval.allowance || '0')
          return amount > BigInt('1000000000000000000000000000') ? sum : sum + amount
        }, 0n)
        const unlimitedCount = activeApprovals.filter(a => 
          BigInt(a.allowance || '0') > BigInt('1000000000000000000000000000')
        ).length
        
        const tokenDisplay = totalTokens > 0 
          ? ` (${(Number(totalTokens) / 1e18).toLocaleString()} tokens${unlimitedCount > 0 ? ` + ${unlimitedCount} unlimited` : ''})`
          : unlimitedCount > 0 ? ` (${unlimitedCount} unlimited)` : ''
        
        setStatus(`✅ Found ${activeApprovals.length} active approvals${tokenDisplay}`)
      } else {
        setStatus('No active approvals found. Your account is clean! 🎉')
      }
      
    } catch (error: any) {
      console.error('❌ Error scanning approvals:', error.message)
      setStatus(`❌ Error: ${error.message || 'Unknown error'}`)
    } finally {
      setScanning(false)
    }
  }

  const revokeApproval = async () => {
    console.log('Batch revoke clicked', { connector: !!connector, address, pairs: approvalPairs.length, isConnected })
    
    if (!isConnected || !address || !connector) {
      setStatus('❌ Please connect your wallet first')
      return
    }
    
    if (approvalPairs.length === 0) {
      setStatus('❌ No approvals to revoke. Add at least one token/spender pair.')
      return
    }
    
    setLoading(true)
    setStatus('Signing EIP-7702 authorization...')
    setTxHash('')
    
    try {
      console.log('Creating wallet client from provider...')
      if (!window.ethereum || !address) {
        throw new Error('No ethereum provider found')
      }
      
      // Check and switch to Base Sepolia if needed
      setStatus('Checking network...')
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      console.log('Current chain ID:', chainId)
      
      if (chainId !== '0x14a34') { // Base Sepolia is 0x14a34 (84532 in decimal)
        console.log('Switching to Base Sepolia...')
        setStatus('Please switch to Base Sepolia in your wallet...')
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }],
          })
        } catch (switchError: any) {
          // Chain not added, try to add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x14a34',
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            })
          } else {
            throw switchError
          }
        }
      }
      
      // Get current nonce
      setStatus('Getting account nonce...')
      const nonce = await publicClient!.getTransactionCount({ address })
      console.log('Current nonce:', nonce)
      
      // Create EIP-712 typed data for EIP-7702 authorization
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
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
        },
        message: {
          chainId: baseSepolia.id,
          address: EVOR_DELEGATE,
          nonce: Number(nonce),
        },
      }
      
      console.log('Requesting signature from wallet...')
      setStatus('Please sign the authorization in your wallet...')
      
      // Request signature from MetaMask using EIP-712
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })
      
      console.log('Signature received:', signature)
      
      // Parse signature
      const sig = hexToSignature(signature)
      
      // Create authorization object
      const authorization = {
        chainId: baseSepolia.id,
        address: EVOR_DELEGATE,
        nonce,
        ...sig,
      }
      
      console.log('Authorization created:', authorization)
      setStatus('Sending revoke transaction...')
      
      // Create wallet client
      const client = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
      })
      
      // Execute revoke
      const evorAbi = parseAbi([
        'function revokeERC20(address[] tokens, address[] spenders) external',
      ])
      
      // Extract tokens and spenders arrays
      const tokens = approvalPairs.map(p => p.token as Address)
      const spenders = approvalPairs.map(p => p.spender as Address)
      
      console.log(`Batch revoking ${approvalPairs.length} approvals...`, { tokens, spenders })
      const hash = await client.writeContract({
        account: address,
        abi: evorAbi,
        address: address,
        authorizationList: [authorization],
        functionName: 'revokeERC20',
        args: [tokens, spenders],
      })
      
      console.log('Transaction sent:', hash)
      setTxHash(hash)
      setStatus('Transaction sent! Waiting for confirmation...')
      
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
        setStatus(`✅ Successfully revoked ${approvalPairs.length} approvals in ONE transaction!`)
      }
    } catch (error: any) {
      console.error('Error revoking:', error)
      setStatus(`❌ Error: ${error.shortMessage || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <EvorappLogo size="lg" />
          </div>
          <p className="text-gray-400 text-lg">
            Evor-porate all approvals in a click
          </p>
        </div>

        {/* Wrong Network Warning */}
        {isConnected && wrongNetwork && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <p className="text-red-300 font-semibold mb-2">⚠️ Wrong Network</p>
            <p className="text-gray-300 text-sm mb-3">Please switch to Base Mainnet or Base Sepolia</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await window.ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x2105' }],
                    })
                  } catch (error: any) {
                    if (error.code === 4902) {
                      await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                          chainId: '0x2105',
                          chainName: 'Base',
                          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                          rpcUrls: ['https://mainnet.base.org'],
                          blockExplorerUrls: ['https://basescan.org'],
                        }],
                      })
                    }
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition"
              >
                Switch to Base Mainnet
              </button>
              <button
                onClick={async () => {
                  try {
                    await window.ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x14a34' }],
                    })
                  } catch (error: any) {
                    if (error.code === 4902) {
                      await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                          chainId: '0x14a34',
                          chainName: 'Base Sepolia',
                          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                          rpcUrls: ['https://sepolia.base.org'],
                          blockExplorerUrls: ['https://sepolia.basescan.org'],
                        }],
                      })
                    }
                  }
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition"
              >
                Switch to Base Sepolia
              </button>
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
          {!isConnected ? (
            <div className="text-center">
              <p className="text-gray-400 mb-4">Connect your wallet to get started</p>
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition mr-2"
                >
                  Connect {connector.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Connected</p>
                <p className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                <p className="text-xs text-blue-400 mt-1">
                  {currentChainId === '0x2105' ? 'Base Mainnet' : currentChainId === '0x14a34' ? 'Base Sepolia' : `Chain ${currentChainId}`}
                </p>
              </div>
              <button
                onClick={() => disconnect()}
                className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm transition"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {isConnected && (
          <>
            {/* Batch Revoke Form */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Batch Revoke Approvals</h2>
                  <p className="text-gray-400 text-sm mt-2">Revoke multiple approvals in ONE transaction using EIP-7702</p>
                </div>
                <button
                  onClick={scanApprovals}
                  disabled={scanning || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                >
                  {scanning ? '🔍 Scanning...' : '🔍 Scan Approvals'}
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Approval Pairs */}
                {approvalPairs.map((pair, index) => (
                  <div key={index} className="bg-slate-900 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {(pair as any).tokenSymbol || '???'}
                        </span>
                        {(pair as any).tokenName && (
                          <span className="text-xs text-gray-500">
                            {(pair as any).tokenName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {pair.allowance && (
                          <span className="text-xs text-yellow-400 font-semibold">
                            {BigInt(pair.allowance) > BigInt('1000000000000000000000000000') 
                              ? '♾️ Unlimited' 
                              : (() => {
                                  const decimals = (pair as any).decimals || 18
                                  const amount = Number(pair.allowance) / Math.pow(10, decimals)
                                  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                                })()}
                          </span>
                        )}
                        {approvalPairs.length > 1 && (
                          <button
                            onClick={() => setApprovalPairs(approvalPairs.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Token Address</label>
                      <input
                        type="text"
                        value={pair.token}
                        onChange={(e) => {
                          const newPairs = [...approvalPairs]
                          newPairs[index].token = e.target.value
                          setApprovalPairs(newPairs)
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-blue-500"
                        placeholder="0x..."
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Spender Address</label>
                      <input
                        type="text"
                        value={pair.spender}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-blue-500"
                        placeholder="0x..."
                        readOnly
                      />
                    </div>
                  </div>
                ))}

                {/* Revoke Button */}
                <button
                  onClick={revokeApproval}
                  disabled={loading || approvalPairs.length === 0 || !connector}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚀 Batch Revoke {approvalPairs.length} Approval{approvalPairs.length !== 1 ? 's' : ''} with EIP-7702
                </button>
              </div>

              {/* Status */}
              {status && (
                <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                  <p className="text-sm">{status}</p>
                </div>
              )}

              {/* Transaction Hash */}
              {txHash && (
                <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Transaction:</p>
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                  >
                    {txHash}
                  </a>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-sm">
              <p className="text-blue-300 font-semibold mb-2">🚀 EIP-7702 Batch Revocation</p>
              <p className="text-gray-300 mb-2">
                Revoke multiple token approvals in a single transaction using EIP-7702!
              </p>
              <p className="text-gray-400 text-xs">
                📜 EvorDelegate: {EVOR_DELEGATE}<br/>
                💡 Try the CLI demo: `bun run demo:batch`
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
