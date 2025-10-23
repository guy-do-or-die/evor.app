import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import "dotenv/config";

const USER_ADDRESS = "0x7db7ec6721cd5c83624e6b628210799e0b561200";
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e";

// Known spenders from create-test-approvals.ts
const SPENDERS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
];

async function main() {
  console.log("Checking current approvals on Base Sepolia...\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC),
  });

  const erc20Abi = parseAbi([
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
  ]);

  console.log(`User: ${USER_ADDRESS}`);
  console.log(`Token: ${TEST_TOKEN}\n`);

  // Check balance
  const balance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [USER_ADDRESS],
  });
  console.log(`Token Balance: ${balance.toString()}\n`);

  // Check all allowances
  console.log("📊 Current Allowances:");
  let activeCount = 0;
  for (const spender of SPENDERS) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [USER_ADDRESS, spender],
    });
    if (allowance > 0n) {
      console.log(`  ✅ ${spender}: ${allowance.toString()}`);
      activeCount++;
    } else {
      console.log(`  ❌ ${spender}: 0 (revoked)`);
    }
  }

  console.log(`\n📈 Total active approvals: ${activeCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
