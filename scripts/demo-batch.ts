import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

/**
 * EIP-7702 BATCH Demonstration
 * Shows revoking MULTIPLE approvals in ONE transaction
 */

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const; // WORKING
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;

// Multiple spenders to demonstrate batch revocation
const SPENDERS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
] as const;

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  EIP-7702 BATCH Approval Revocation Demo");
  console.log("  Revoking MULTIPLE approvals in ONE transaction");
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
  console.log(`📜 EvorDelegate: ${EVOR_DELEGATE}`);
  console.log(`🪙 Test Token: ${TEST_TOKEN}\n`);

  // Step 1: Set up multiple approvals
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Step 1: Setting up multiple approvals");
  console.log("═══════════════════════════════════════════════════════\n");

  const amounts = [
    1000000000000000000n, // 1 token
    2000000000000000000n, // 2 tokens
    3000000000000000000n, // 3 tokens
  ];

  for (let i = 0; i < SPENDERS.length; i++) {
    const currentAllowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, SPENDERS[i]],
    });

    if (currentAllowance === 0n) {
      console.log(`Creating approval ${i + 1}/${SPENDERS.length} for ${SPENDERS[i]}...`);
      const hash = await walletClient.writeContract({
        address: TEST_TOKEN,
        abi: erc20Abi,
        functionName: "approve",
        args: [SPENDERS[i], amounts[i]],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ Approved ${amounts[i].toString()} tokens`);
      // Small delay to avoid nonce conflicts
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log(`✓ Approval ${i + 1}/${SPENDERS.length} already exists: ${currentAllowance.toString()} tokens`);
    }
  }

  // Check all allowances BEFORE
  console.log("\n📊 Allowances BEFORE batch revocation:");
  const beforeAllowances: bigint[] = [];
  for (const spender of SPENDERS) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    beforeAllowances.push(allowance);
    console.log(`  ${spender}: ${allowance.toString()}`);
  }

  const totalBefore = beforeAllowances.reduce((sum, val) => sum + val, 0n);
  console.log(`\n  Total approved: ${totalBefore.toString()} tokens`);

  // Step 2: EIP-7702 BATCH revoke
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Step 2: EIP-7702 BATCH Revoke");
  console.log("  🔥 Revoking ALL approvals in ONE transaction");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Signing EIP-7702 Authorization...");
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
    executor: 'self',
  });
  console.log(`✅ Authorization signed (nonce: ${authorization.nonce})\n`);

  console.log(`Sending batch revoke for ${SPENDERS.length} approvals...`);
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  // Create arrays with same token for each spender
  const tokens = SPENDERS.map(() => TEST_TOKEN);

  const hash = await walletClient.writeContract({
    abi: evorAbi,
    address: account.address,
    authorizationList: [authorization],
    functionName: "revokeERC20",
    args: [tokens, SPENDERS],
  });

  console.log(`📤 Transaction: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
  console.log(`⛽ Gas used: ${receipt.gasUsed}`);
  console.log(`📋 Events emitted: ${receipt.logs.length}`);

  // Wait for state to propagate
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check all allowances AFTER
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Result");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("📊 Allowances AFTER batch revocation:");
  const afterAllowances: bigint[] = [];
  let allRevoked = true;

  for (const spender of SPENDERS) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    afterAllowances.push(allowance);
    console.log(`  ${spender}: ${allowance.toString()}`);
    if (allowance !== 0n) allRevoked = false;
  }

  const totalAfter = afterAllowances.reduce((sum, val) => sum + val, 0n);

  console.log(`\n  Total approved: ${totalAfter.toString()} tokens`);
  console.log(`  Revoked: ${totalBefore.toString()} tokens\n`);

  if (allRevoked) {
    console.log("🎉 SUCCESS!");
    console.log(`✅ Revoked ${SPENDERS.length} approvals in ONE transaction using EIP-7702`);
    console.log(`✅ Saved ${SPENDERS.length - 1} transactions compared to traditional approach`);
    console.log(`✅ Gas efficient batch operation\n`);
  } else {
    console.log("❌ Some approvals not revoked\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
