import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

/**
 * EIP-7702 Demonstration Script
 * 
 * This script demonstrates batch approval revocation using EIP-7702
 * on Base Sepolia. It shows how ONE transaction can revoke multiple
 * token approvals by temporarily delegating the EOA to a smart contract.
 */

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const; // WORKING
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  EIP-7702 Batch Approval Revocation Demo");
  console.log("  Base Sepolia");
  console.log("═══════════════════════════════════════════════════════\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`📍 Account: ${account.address}`);
  console.log(`📜 EvorDelegate: ${EVOR_DELEGATE}\n`);

  // Check current state
  const currentAllowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER],
  });

  console.log(`Current approval: ${currentAllowance.toString()}`);

  if (currentAllowance === 0n) {
    console.log("\n✨ Creating test approval...");
    const hash = await walletClient.writeContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [SPENDER, 1000000000000000000n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Test approval created\n");
  }

  // The EIP-7702 magic
  console.log("═══════════════════════════════════════════════════════");
  console.log("  EIP-7702: Batch Revoke in ONE Transaction");  
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Step 1: Sign EIP-7702 Authorization");
  console.log("  → Temporarily delegate EOA to EvorDelegate contract");
  
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
    executor: 'self', // Critical: same account signs AND executes
  });
  
  console.log(`  ✅ Authorization signed (nonce: ${authorization.nonce})\n`);

  console.log("Step 2: Execute Batch Revoke");
  console.log("  → Sending Type-4 transaction with authorization list");
  
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  const hash = await walletClient.writeContract({
    abi: evorAbi,
    address: account.address, // Send TO ourselves!
    authorizationList: [authorization],
    functionName: "revokeERC20",
    args: [[TEST_TOKEN], [SPENDER]],
  });

  console.log(`  📤 Transaction: ${hash}`);
  console.log(`  🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
  console.log(`  ⛽ Gas used: ${receipt.gasUsed}`);
  console.log(`  📋 Events emitted: ${receipt.logs.length}\n`);

  // Small delay to ensure state is propagated
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify result
  const afterAllowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER],
  });

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Result");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log(`Allowance after: ${afterAllowance.toString()}`);
  
  if (afterAllowance === 0n) {
    console.log("\n🎉 SUCCESS!");
    console.log("✅ Approval revoked using EIP-7702");
    console.log("✅ Single transaction for batch operation");
    console.log("✅ EOA delegation works as expected\n");
  } else {
    console.log("\n❌ Unexpected: Allowance not revoked\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
