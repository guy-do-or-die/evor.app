import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

/**
 * Comprehensive Test Approvals Script
 * 
 * Creates:
 * - ERC20 approvals (including PERMIT2 with UNLIMITED approval)
 * - ERC721 NFT approvals (ApprovalForAll)
 * - ERC1155 NFT approvals (ApprovalForAll)
 * 
 * Uses manual nonce tracking and 2-second delays after each transaction
 * to avoid "in-flight transaction limit" errors from Base Sepolia public RPC.
 * 
 * Runtime: ~50 seconds for all 16 approvals (or instant with Ankr API key)
 */

// Base Sepolia Test Tokens & Collections
const TOKENS = {
  // Our test token
  testToken: "0x3f1bfb16a75277d5826d195506b011a79fd9626e",
  // Add more Base Sepolia ERC20 tokens here if available
  // USDC Base Sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
};

// NFT Collections on Base Sepolia
const NFT_COLLECTIONS = {
  testNFT721: "0x155ddba78142261e2a4bc18d114b92351fc5d649",
  testNFT1155: "0x38ca819c7979b577478d9f6f6336129fd867d2c8", // Updated with supportsInterface
};

// Random addresses to use as spenders/operators
const SPENDERS = [
  "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Real Permit2 (FIRST for priority)
  "0x1111111111111111111111111111111111111111", // Fake DEX 1
  "0x2222222222222222222222222222222222222222", // Fake DEX 2
  "0x3333333333333333333333333333333333333333", // Fake Marketplace 1
  "0x4444444444444444444444444444444444444444", // Fake Marketplace 2
  "0x5555555555555555555555555555555555555555", // Fake Bridge
  "0x6666666666666666666666666666666666666666", // Fake Aggregator
  "0x7777777777777777777777777777777777777777", // Fake Lending
  "0x8888888888888888888888888888888888888888", // Fake Staking
] as const;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function symbol() external view returns (string)",
]);

const nftAbi = parseAbi([
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
]);

// Helper to add delay between transactions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get best available RPC
function getRpcUrl(): string {
  // Priority 1: Explicit RPC URL
  if (process.env.BASE_SEPOLIA_RPC) {
    return process.env.BASE_SEPOLIA_RPC;
  }
  
  // Priority 2: Ankr API Key
  if (process.env.VITE_ANKR_API_KEY) {
    return `https://rpc.ankr.com/base_sepolia/${process.env.VITE_ANKR_API_KEY}`;
  }
  
  // Fallback: Public RPC (rate limited)
  return "https://sepolia.base.org";
}

async function main() {
  console.log("🚀 Creating comprehensive test approvals on Base Sepolia\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  
  const rpcUrl = getRpcUrl();
  const rpcLabel = rpcUrl.includes('ankr') 
    ? '✅ Ankr (Premium - No rate limits!)' 
    : '⚠️  Public RPC (Rate limited - may fail after 6-7 transactions)';
  console.log(`RPC: ${rpcLabel}\n`);
  
  const transport = http(rpcUrl);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });

  console.log(`Account: ${account.address}\n`);

  // Get initial nonce and track it manually
  let currentNonce = await publicClient.getTransactionCount({ 
    address: account.address,
    blockTag: 'latest'
  });
  const startingNonce = currentNonce;
  console.log(`Starting nonce: ${currentNonce}\n`);

  // ============================================================================
  // 1. CREATE ERC20 APPROVALS
  // ============================================================================
  
  console.log("📝 Creating ERC20 Approvals...\n");
  
  const tokenEntries = Object.entries(TOKENS).filter(([_, addr]) => addr !== "0x0000000000000000000000000000000000000000");
  
  for (const [name, tokenAddress] of tokenEntries) {
    console.log(`\n🪙 Token: ${name} (${tokenAddress})`);
    
    // Get token symbol
    try {
      const symbol = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      });
      console.log(`   Symbol: ${symbol}`);
    } catch {
      console.log(`   Symbol: Unknown`);
    }
    
    // Create approvals for multiple spenders
    const spendersToApprove = SPENDERS.slice(0, 6); // First 6 spenders per token (including Permit2)
    
    for (let i = 0; i < spendersToApprove.length; i++) {
      const spender = spendersToApprove[i];
      const amount = i === 0 
        ? BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935") // Max uint256 for first one
        : BigInt((i + 1) * 1000) * BigInt(10 ** 18); // 1k, 2k, 3k, 4k, 5k tokens
      
      const label = spender.toLowerCase() === '0x000000000022d473030f116ddee9f6b43ac78ba3' ? 'PERMIT2 UNLIMITED' : i === 0 ? 'UNLIMITED' : `${(i + 1) * 1000} tokens`;
      console.log(`   [${i + 1}/${spendersToApprove.length}] Approving ${spender.slice(0, 10)}... for ${label} (nonce: ${currentNonce})`);
      
      let txHash: string | undefined;
      try {
        const hash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amount],
          nonce: currentNonce,
          gas: 100000n, // Explicit gas limit
        });
        
        txHash = hash;
        console.log(`   📤 Submitted: ${hash.slice(0, 20)}...`);
        
        await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        console.log(`   ✅ Confirmed!`);
        
        // CRITICAL: Wait for RPC mempool to update after confirmation
        // Base Sepolia public RPC needs ~2 seconds to clear in-flight status
        await delay(2000);
      } catch (error: any) {
        if (txHash) {
          console.error(`   ⏳ Submitted but confirmation timeout: ${txHash.slice(0, 20)}...`);
          console.error(`      (Transaction may still succeed - check later)`);
        } else {
          console.error(`   ❌ Failed to submit: ${error.shortMessage || error.message}`);
          console.error(`      Error details: ${JSON.stringify(error.details || error.cause?.details || 'No details')}`);
        }
      }
      
      // Always increment nonce, whether success or failure
      currentNonce++;
      
      // Additional delay between transactions
      if (i < spendersToApprove.length - 1) {
        await delay(500);
      }
    }
  }

  // ============================================================================
  // 2. CREATE NFT APPROVALS (ERC721/ERC1155)
  // ============================================================================
  
  // Longer delay after ERC20 section to let RPC state propagate
  console.log("\n\n⏳ Waiting 3 seconds for RPC state to settle...");
  await delay(3000);
  
  console.log("\n🎨 Creating NFT ApprovalForAll...\n");
  
  const nftEntries = Object.entries(NFT_COLLECTIONS).filter(([_, addr]) => addr !== "0x0000000000000000000000000000000000000000");
  
  if (nftEntries.length === 0) {
    console.log("⚠️  No NFT collections configured. Add real Base Sepolia NFT addresses to test.");
    console.log("   You can:");
    console.log("   1. Deploy a simple ERC721 test contract");
    console.log("   2. Find existing Base Sepolia NFT collections");
    console.log("   3. Use OpenSea's testnet contracts\n");
  }
  
  for (const [name, collectionAddress] of nftEntries) {
    console.log(`\n🖼️  Collection: ${name} (${collectionAddress})`);
    
    // Create approvals for multiple operators
    const operatorsToApprove = SPENDERS.slice(2, 7); // Different set of spenders for NFTs
    
    for (let i = 0; i < operatorsToApprove.length; i++) {
      const operator = operatorsToApprove[i];
      
      console.log(`   [${i + 1}/${operatorsToApprove.length}] Setting approval for ${operator.slice(0, 10)}... (nonce: ${currentNonce})`);
      
      let txHash: string | undefined;
      try {
        const hash = await walletClient.writeContract({
          address: collectionAddress as `0x${string}`,
          abi: nftAbi,
          functionName: "setApprovalForAll",
          args: [operator, true],
          nonce: currentNonce,
          gas: 100000n, // Explicit gas limit
        });
        
        txHash = hash;
        console.log(`   📤 Submitted: ${hash.slice(0, 20)}...`);
        
        await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
        console.log(`   ✅ Confirmed!`);
        
        // CRITICAL: Wait for RPC mempool to update after confirmation
        // Base Sepolia public RPC needs ~2 seconds to clear in-flight status
        await delay(2000);
      } catch (error: any) {
        if (txHash) {
          console.error(`   ⏳ Submitted but confirmation timeout: ${txHash.slice(0, 20)}...`);
          console.error(`      (Transaction may still succeed - check later)`);
        } else {
          console.error(`   ❌ Failed to submit: ${error.shortMessage || error.message}`);
          console.error(`      Error details: ${JSON.stringify(error.details || error.cause?.details || 'No details')}`);
        }
      }
      
      // Always increment nonce, whether success or failure
      currentNonce++;
      
      // Additional delay between transactions
      if (i < operatorsToApprove.length - 1) {
        await delay(500);
      }
    }
  }

  // ============================================================================
  // 3. VERIFY ALL APPROVALS
  // ============================================================================
  
  console.log("\n\n📊 Verification Summary:\n");
  
  // Check ERC20 approvals
  console.log("🪙 ERC20 Approvals:");
  let erc20Count = 0;
  for (const [name, tokenAddress] of tokenEntries) {
    for (const spender of SPENDERS.slice(0, 6)) { // Check all 6 spenders including PERMIT2
      try {
        const allowance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account.address, spender],
        });
        if (allowance > 0n) {
          erc20Count++;
          const display = allowance > BigInt(10 ** 30) ? "UNLIMITED" : `${Number(allowance) / 10 ** 18} tokens`;
          console.log(`   ✅ ${name} → ${spender.slice(0, 10)}...: ${display}`);
        }
      } catch {}
    }
  }
  
  // Check NFT approvals
  console.log("\n🎨 NFT Approvals:");
  let nftCount = 0;
  for (const [name, collectionAddress] of nftEntries) {
    for (const operator of SPENDERS.slice(2, 7)) {
      try {
        const isApproved = await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: nftAbi,
          functionName: "isApprovedForAll",
          args: [account.address, operator],
        });
        if (isApproved) {
          nftCount++;
          console.log(`   ✅ ${name} → ${operator.slice(0, 10)}...: APPROVED`);
        }
      } catch {}
    }
  }

  console.log(`\n\n✅ Done! Created:`);
  console.log(`   📝 ${erc20Count} ERC20 approvals`);
  console.log(`   🎨 ${nftCount} NFT approvals`);
  console.log(`   📊 Total: ${erc20Count + nftCount} approvals`);
  console.log(`\n   ⛓️  Nonces used: ${startingNonce} → ${currentNonce - 1} (${currentNonce - startingNonce} transactions)`);
  
  if (erc20Count + nftCount === 0) {
    console.log("\n⚠️  No approvals were created. Check:");
    console.log("   1. Token/NFT addresses are correct");
    console.log("   2. You have ETH for gas");
    console.log("   3. RPC is working");
  }
  
  // Show tip if using public RPC and had failures
  const expectedCount = 6 + 10; // 6 ERC20 + 10 NFT
  if (!rpcUrl.includes('ankr') && (erc20Count + nftCount) < expectedCount) {
    console.log("\n💡 Tip: Add VITE_ANKR_API_KEY to .env.local to avoid rate limiting");
    console.log("   Get free key at: https://www.ankr.com/rpc/");
    console.log("   This will allow all approvals to be created successfully!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
