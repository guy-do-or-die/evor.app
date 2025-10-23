import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors'

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'evor.app' }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})
