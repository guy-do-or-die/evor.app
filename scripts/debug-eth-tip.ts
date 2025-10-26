import { createPublicClient, http, parseAbi, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";

const TX_HASH = "0xa0ff2c3358d0f9c1d539f97aa656e2ad58561722aa932362446679e3dd43377f" as const;
const CONTRACT = "0x0c2535396ab1d41d82404b09e18c4ae1431e7cba" as const;

async function main() {
  console.log("🔍 Debugging failed tip transaction\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
  });

  // Get transaction details
  const tx = await publicClient.getTransaction({ hash: TX_HASH });
  const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH });

  console.log("📤 Transaction Details:");
  console.log(`  From: ${tx.from}`);
  console.log(`  To: ${tx.to}`);
  console.log(`  Value: ${tx.value} wei (${Number(tx.value) / 1e18} ETH)`);
  console.log(`  Gas: ${tx.gas}`);
  console.log(`  Gas Price: ${tx.gasPrice}`);
  console.log(`  Status: ${receipt.status}\n`);

  console.log("📋 Authorization List:");
  if (tx.authorizationList && tx.authorizationList.length > 0) {
    tx.authorizationList.forEach((auth, i) => {
      console.log(`  [${i}] Address: ${auth.address}`);
      console.log(`      Chain ID: ${auth.chainId}`);
      console.log(`      Nonce: ${auth.nonce}`);
    });
  } else {
    console.log("  ⚠️ No authorization list found!");
  }

  console.log("\n📝 Logs:");
  console.log(`  Total logs: ${receipt.logs.length}`);
  
  if (receipt.logs.length === 0) {
    console.log("  ❌ NO LOGS - Transaction reverted before executing contract code");
    console.log("\n💡 This means:");
    console.log("  1. Revert happened at EVM level (before contract execution)");
    console.log("  2. Possible insufficient gas");
    console.log("  3. Possible authorization issue");
    console.log("  4. Possible issue with value transfer in EIP-7702");
  } else {
    receipt.logs.forEach((log, i) => {
      console.log(`  [${i}] ${log.address}`);
      console.log(`      Topics: ${log.topics.length}`);
    });
  }

  console.log("\n🔬 Attempting to simulate the call...");
  
  // Try to simulate without value first
  try {
    const abi = parseAbi([
      "function revokeERC20(address[] tokens, address[] spenders) external payable",
    ]);

    // Decode the input data to see what was called
    console.log("\n📊 Input Data Analysis:");
    console.log(`  Data: ${tx.input.slice(0, 66)}...`);
    console.log(`  Function selector: ${tx.input.slice(0, 10)}`);
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }

  // Check if the EOA had the delegation
  console.log("\n🔗 Checking delegation status:");
  const code = await publicClient.getCode({ address: tx.from, blockNumber: receipt.blockNumber - 1n });
  if (code && code !== '0x') {
    console.log(`  ✅ EOA was delegated (code length: ${code.length})`);
  } else {
    console.log(`  ❌ EOA was NOT delegated at execution time!`);
  }

  // Most likely issue: EIP-7702 doesn't support value transfers
  console.log("\n⚠️  LIKELY ROOT CAUSE:");
  console.log("  EIP-7702 transactions with authorizationList may not support msg.value > 0");
  console.log("  The transaction is self-calling (from = to) with delegated code");
  console.log("  When you send ETH to yourself with delegated code, the ETH transfer might fail");
  console.log("\n💡 SOLUTION:");
  console.log("  Separate the tip into a second transaction AFTER revocation");
  console.log("  OR: Have users send tip directly to support address separately");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
