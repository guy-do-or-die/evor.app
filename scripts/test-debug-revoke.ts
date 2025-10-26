import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("🔍 Debugging EvorDelegate contract call\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`EvorDelegate: ${EVOR_DELEGATE}`);
  console.log(`Test Token: ${TEST_TOKEN}\n`);

  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });

  console.log(`Current allowance: ${currentAllowance.toString()}`);

  // Create approval if needed
  if (currentAllowance === 0n) {
    console.log("\n✨ Creating test approval...");
    const hash = await walletClient.writeContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [SPENDER_A, 1000000000000000000n],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Test approval created\n");
  }

  // Now test EIP-7702 revocation
  console.log("═══════════════════════════════════════════");
  console.log("Testing EIP-7702 revocation");
  console.log("═══════════════════════════════════════════\n");

  console.log("Step 1: Sign authorization");
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
    executor: 'self',
  });
  console.log(`✅ Authorization signed (nonce: ${authorization.nonce})\n`);

  console.log("Step 2: Call revokeERC20");
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  try {
    const hash = await walletClient.writeContract({
      abi: evorAbi,
      address: account.address,
      authorizationList: [authorization],
      functionName: "revokeERC20",
      args: [[TEST_TOKEN], [SPENDER_A]],
    });

    console.log(`📤 Transaction: ${hash}`);
    console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status}`);
    
    if (receipt.status === 'reverted') {
      console.log("\n❌ TRANSACTION REVERTED!");
    } else {
      console.log("\n✅ Transaction successful!");
    }

    // Check allowance after
    await new Promise(resolve => setTimeout(resolve, 2000));
    const afterAllowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, SPENDER_A],
    });
    console.log(`\nAllowance after: ${afterAllowance.toString()}`);

  } catch (error: any) {
    console.error("\n❌ Error:", error);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
    if (error.data) {
      console.error("Data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
