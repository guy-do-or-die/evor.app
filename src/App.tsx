import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWalletClient, usePublicClient } from 'wagmi'
import { parseAbi, type Address, hexToSignature, createWalletClient, custom } from 'viem'
import { baseSepolia } from 'wagmi/chains'

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
  
  // Check network on connect
  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum && isConnected) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        setWrongNetwork(chainId !== '0x14a34')
      }
    }
    checkNetwork()
    
    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId: string) => {
        setWrongNetwork(chainId !== '0x14a34')
      })
    }
  }, [isConnected])

  const scanApprovals = async () => {
    if (!address || !publicClient) return
    
    setScanning(true)
    setStatus('Scanning for approvals with HyperSync...')
    
    try {
      console.log('Querying HyperSync REST API for Base Sepolia...')
      
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
          log: ['address', 'topic0', 'topic1', 'topic2', 'topic3', 'data'],
        },
      }
      
      console.log('Sending query to HyperSync...')
      console.log('Query:', query)
      console.log('API Token:', import.meta.env.VITE_HYPERSYNC_TOKEN ? 'Set' : 'Missing')
      setStatus('Querying HyperSync...')
      
      const url = '/hypersync/query'
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_HYPERSYNC_TOKEN}`,
      }
      const body = JSON.stringify(query)
      
      console.log('Request URL:', url)
      console.log('Request Headers:', headers)
      console.log('Request Body:', body)
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`HyperSync API error: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('HyperSync response:', data)
      
      // Flatten logs from all blocks
      const allLogs: any[] = []
      if (data.data && Array.isArray(data.data)) {
        for (const block of data.data) {
          if (block.logs && Array.isArray(block.logs)) {
            allLogs.push(...block.logs)
          }
        }
      }
      
      console.log(`Found ${allLogs.length} approval events`)
      
      // Parse unique token/spender pairs
      const uniquePairs = new Map<string, { token: string; spender: string }>()
      
      for (const log of allLogs) {
        const tokenAddress = log.address
        // topic2 is the spender address (indexed parameter)
        const spenderTopic = log.topic2
        if (tokenAddress && spenderTopic) {
          const spender = `0x${spenderTopic.slice(26)}` // Remove padding
          const key = `${tokenAddress}-${spender}`
          uniquePairs.set(key, { token: tokenAddress, spender })
        }
      }
      
      console.log(`Found ${uniquePairs.size} unique approval pairs, checking current allowances...`)
      setStatus(`Checking ${uniquePairs.size} approvals...`)
      
      // Check current allowances
      const erc20Abi = parseAbi(['function allowance(address owner, address spender) external view returns (uint256)'])
      const activeApprovals: Array<{ token: string; spender: string; allowance: string }> = []
      
      for (const [, pair] of uniquePairs) {
        try {
          const allowance = await publicClient.readContract({
            address: pair.token as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, pair.spender as Address],
          })
          
          if (allowance > 0n) {
            activeApprovals.push({
              ...pair,
              allowance: allowance.toString(),
            })
            console.log(`Active: ${pair.token} → ${pair.spender}: ${allowance}`)
          }
        } catch (error) {
          // Silently skip invalid tokens
        }
      }
      
      setApprovalPairs(activeApprovals)
      setStatus(activeApprovals.length > 0 
        ? `✅ Found ${activeApprovals.length} active approvals via HyperSync` 
        : 'No active approvals found. Your account is clean! 🎉')
      
      console.log(`HyperSync scan complete: ${activeApprovals.length} active approvals`)
      
    } catch (error: any) {
      console.error('Error scanning approvals:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      })
      setStatus(`❌ Error scanning: ${error.message || 'Unknown error'}`)
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
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            evor.app
          </h1>
          <p className="text-gray-400 text-lg">
            Revoke token approvals using EIP-7702
          </p>
        </div>

        {/* Wrong Network Warning */}
        {isConnected && wrongNetwork && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <p className="text-red-300 font-semibold mb-2">⚠️ Wrong Network</p>
            <p className="text-gray-300 text-sm mb-3">Please switch to Base Sepolia to continue</p>
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
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition"
            >
              Switch to Base Sepolia
            </button>
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
                <p className="text-xs text-blue-400 mt-1">Base Sepolia</p>
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
                      <span className="text-sm font-semibold text-gray-300">Approval #{index + 1}</span>
                      {approvalPairs.length > 1 && (
                        <button
                          onClick={() => setApprovalPairs(approvalPairs.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      )}
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
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Spender Address</label>
                      <input
                        type="text"
                        value={pair.spender}
                        onChange={(e) => {
                          const newPairs = [...approvalPairs]
                          newPairs[index].spender = e.target.value
                          setApprovalPairs(newPairs)
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-blue-500"
                        placeholder="0x..."
                      />
                    </div>
                  </div>
                ))}

                {/* Add More Button */}
                <button
                  onClick={() => setApprovalPairs([...approvalPairs, { token: '0x', spender: '0x' }])}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm transition"
                >
                  + Add Another Approval
                </button>

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
