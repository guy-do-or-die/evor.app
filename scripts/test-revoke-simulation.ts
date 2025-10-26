import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0xc920ccafc14ab6c0ca4b59dd8438f94a68cf7e06" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("🧪 Testing EIP-7702 revocation with new contract\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  console.log(`Account: ${account.address}`);
  console.log(`Contract: ${EVOR_DELEGATE}`);
  console.log(`Test Token: ${TEST_TOKEN}\n`);

  // Check if we have an approval first
  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  const allowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER],
  });

  console.log(`Current allowance: ${allowance.toString()}`);

  if (allowance === 0n) {
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

  // Test EIP-7702 with the new payable contract
  console.log("═══════════════════════════════════════");
  console.log("Testing EIP-7702 Revocation (Payable)");
  console.log("═══════════════════════════════════════\n");

  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external payable",
  ]);

  // First, try simulation
  console.log("1️⃣ Simulating transaction...");
  
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
  });

  try {
    await publicClient.simulateContract({
      account: account.address,
      address: account.address,
      abi: evorAbi,
      functionName: "revokeERC20",
      args: [[TEST_TOKEN], [SPENDER]],
      authorizationList: [authorization],
      value: 0n, // No tip for test
    } as any);
    console.log("✅ Simulation successful!\n");
  } catch (error: any) {
    console.error("❌ Simulation failed:", error);
    console.error("Error details:", error.cause || error.message);
    console.error("\nThis tells us the contract call will fail. Investigating...\n");
    return;
  }

  // If simulation passes, send real transaction
  console.log("2️⃣ Sending real transaction...");
  
  const hash = await walletClient.writeContract({
    account: account.address,
    abi: evorAbi,
    address: account.address,
    authorizationList: [authorization],
    functionName: "revokeERC20",
    args: [[TEST_TOKEN], [SPENDER]],
    value: 0n,
  } as any);

  console.log(`📤 Transaction: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\nStatus: ${receipt.status}`);
  
  if (receipt.status === 'success') {
    console.log("✅ Revocation successful!");
    
    const newAllowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, SPENDER],
    });
    console.log(`New allowance: ${newAllowance.toString()}`);
  } else {
    console.log("❌ Transaction reverted");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
