/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANKR_API_KEY?: string
  readonly VITE_INFURA_API_KEY?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_ETH_RPC_URL?: string
  readonly VITE_BASE_RPC_URL?: string
  readonly VITE_OPTIMISM_RPC_URL?: string
  readonly VITE_ARBITRUM_RPC_URL?: string
  readonly VITE_POLYGON_RPC_URL?: string
  readonly VITE_BSC_RPC_URL?: string
  readonly VITE_SEPOLIA_RPC_URL?: string
  readonly VITE_BASE_SEPOLIA_RPC_URL?: string
  readonly VITE_OPTIMISM_SEPOLIA_RPC_URL?: string
  readonly VITE_ARBITRUM_SEPOLIA_RPC_URL?: string
  readonly VITE_POLYGON_AMOY_RPC_URL?: string
  readonly VITE_BSC_TESTNET_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Ethereum provider types
interface EthereumProvider {
  isMetaMask?: boolean
  isRabby?: boolean
  request(args: { method: string; params?: any[] }): Promise<any>
  on(eventName: string, handler: (...args: any[]) => void): void
  removeListener(eventName: string, handler: (...args: any[]) => void): void
}

interface Window {
  ethereum?: EthereumProvider
}
