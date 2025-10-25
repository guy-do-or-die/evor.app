// Vercel Edge Function - proxies HyperSync requests while keeping token secret
export const config = {
  runtime: 'edge',
}

// Map chain keys to HyperSync subdomain names
const CHAIN_MAP: Record<string, string> = {
  'mainnet': 'eth',
  'eth': 'eth',
  'base': 'base',
  'base-sepolia': 'base-sepolia',
  'optimism': 'optimism',
  'optimism-sepolia': 'optimism-sepolia',
  'arbitrum': 'arbitrum',
  'arbitrum-sepolia': 'arbitrum-sepolia',
  'polygon': 'polygon',
  'polygon-amoy': 'polygon-amoy',
  'bsc': 'bsc',
  'bsc-testnet': 'bsc-testnet',
  'sepolia': 'sepolia',
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const url = new URL(req.url)
  const chainKey = url.searchParams.get('chain')
  
  if (!chainKey) {
    return new Response(JSON.stringify({ error: 'Missing chain parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const hypersyncChain = CHAIN_MAP[chainKey]
  if (!hypersyncChain) {
    return new Response(JSON.stringify({ error: `Unknown chain: ${chainKey}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.text()
    
    const response = await fetch(`https://${hypersyncChain}.hypersync.xyz/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Token is secret server-side env var
        'Authorization': `Bearer ${process.env.HYPERSYNC_TOKEN}`,
      },
      body,
    })

    const data = await response.text()
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Proxy error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
