import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWalletClient, usePublicClient } from 'wagmi'
import { parseAbi, type Address, hexToSignature, numberToHex, createWalletClient, custom } from 'viem'
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

  const [approvalPairs, setApprovalPairs] = useState([
    { token: '0x3f1bfb16a75277d5826d195506b011a79fd9626e', spender: '0x1111111111111111111111111111111111111111' },
    { token: '0x3f1bfb16a75277d5826d195506b011a79fd9626e', spender: '0x2222222222222222222222222222222222222222' },
  ])
  const [status, setStatus] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  
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
              <h2 className="text-2xl font-bold mb-4">Batch Revoke Approvals</h2>
              <p className="text-gray-400 text-sm mb-6">Revoke multiple approvals in ONE transaction using EIP-7702</p>
              
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
