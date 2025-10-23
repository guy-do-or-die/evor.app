import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
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
  console.log("Creating test approvals...\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`Token: ${TEST_TOKEN}`);
  console.log(`Creating ${SPENDERS.length} approvals...\n`);

  // Create approvals for all spenders
  for (let i = 0; i < SPENDERS.length; i++) {
    const spender = SPENDERS[i];
    const amount = BigInt((i + 1) * 1000000000000000000); // 1, 2, 3, ... tokens
    
    console.log(`[${i + 1}/${SPENDERS.length}] Approving ${spender} for ${i + 1} tokens...`);
    
    try {
      const hash = await walletClient.writeContract({
        address: TEST_TOKEN,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Tx: ${hash}\n`);
    } catch (error: any) {
      console.error(`❌ Failed: ${error.message}\n`);
    }
  }

  // Check all allowances
  console.log("📊 Current allowances:");
  for (const spender of SPENDERS) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
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
