import { createWalletClient, http, createPublicClient, parseAbi, type Chain } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Chain configurations
const CHAIN_CONFIGS = {
  'base-sepolia': {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC!,
    testToken: "0x3f1bfb16a75277d5826d195506b011a79fd9626e", // Existing test token
  },
  'sepolia': {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
    testToken: "0x16f9d3a02aed2f4b035680adae7a2d478c88e366", // Deployed TestERC20
  },
} as const;

type SupportedChain = keyof typeof CHAIN_CONFIGS;
// Random addresses to use as spenders
const SPENDERS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
] as const;

async function main() {
  // Get chain from command line argument (e.g., --chain=sepolia)
  const chainArg = process.argv.find(arg => arg.startsWith('--chain='))?.split('=')[1] || 'base-sepolia';
  
  if (!(chainArg in CHAIN_CONFIGS)) {
    console.error(`❌ Unsupported chain: ${chainArg}`);
    console.error(`Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const chainKey = chainArg as SupportedChain;
  const config = CHAIN_CONFIGS[chainKey];
  
  console.log(`Creating test approvals on ${config.chain.name}...\n`);

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(config.rpcUrl);

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport,
  });

  const publicClient = createPublicClient({
    chain: config.chain,
    transport,
  });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`Chain: ${config.chain.name} (${config.chain.id})`);
  console.log(`Account: ${account.address}`);
  console.log(`Token: ${config.testToken}`);
  console.log(`Creating ${SPENDERS.length} approvals...\n`);

  // Create approvals for all spenders (one at a time with fresh nonces)
  for (let i = 0; i < SPENDERS.length; i++) {
    const spender = SPENDERS[i];
    const amount = BigInt((i + 1) * 1000000000000000000); // 1, 2, 3, ... tokens
    
    console.log(`[${i + 1}/${SPENDERS.length}] Approving ${spender} for ${i + 1} tokens...`);
    
    try {
      // Get fresh nonce for each transaction to avoid conflicts
      const nonce = await publicClient.getTransactionCount({ 
        address: account.address,
        blockTag: 'pending' // Include pending transactions
      });
      
      const hash = await walletClient.writeContract({
        address: config.testToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
        nonce, // Explicitly set nonce
      });
      
      // Wait for confirmation before next transaction
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Tx: ${hash}\n`);
    } catch (error: any) {
      console.error(`❌ Failed: ${error.shortMessage || error.message}\n`);
    }
  }

  // Check all allowances
  console.log("📊 Current allowances:");
  for (const spender of SPENDERS) {
    const allowance = await publicClient.readContract({
      address: config.testToken as `0x${string}`,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    if (allowance > 0n) {
      console.log(`  ${spender}: ${allowance.toString()}`);
    }
  }

  console.log("\n✅ All test approvals created!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
