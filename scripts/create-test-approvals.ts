import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
// Random addresses to use as spenders
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;
const SPENDER_B = "0x2222222222222222222222222222222222222222" as const;

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
  console.log(`Token: ${TEST_TOKEN}\n`);

  // Approve SPENDER_A
  console.log(`Approving ${SPENDER_A}...`);
  const hash1 = await walletClient.writeContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [SPENDER_A, 1000000000000000000n], // 1 token
  });
  await publicClient.waitForTransactionReceipt({ hash: hash1 });
  console.log(`✅ Tx: ${hash1}`);

  // Approve SPENDER_B
  console.log(`Approving ${SPENDER_B}...`);
  const hash2 = await walletClient.writeContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [SPENDER_B, 2000000000000000000n], // 2 tokens
  });
  await publicClient.waitForTransactionReceipt({ hash: hash2 });
  console.log(`✅ Tx: ${hash2}`);

  // Check allowances
  console.log("\n📊 Current allowances:");
  const allowanceA = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`  ${SPENDER_A}: ${allowanceA.toString()}`);

  const allowanceB = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_B],
  });
  console.log(`  ${SPENDER_B}: ${allowanceB.toString()}`);

  console.log("\n✅ Test approvals created!");
  console.log("\nUpdate your .env with:");
  console.log(`TOKENS_CSV=${TEST_TOKEN},${TEST_TOKEN}`);
  console.log(`SPENDERS_CSV=${SPENDER_A},${SPENDER_B}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
