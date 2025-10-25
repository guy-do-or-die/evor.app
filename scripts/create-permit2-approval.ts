import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

async function main() {
  console.log("🎯 Creating PERMIT2 Approval...\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

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
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`Token: ${TEST_TOKEN}`);
  console.log(`Spender: PERMIT2 (${PERMIT2})\n`);

  console.log("Approving PERMIT2 for UNLIMITED...");
  
  const amount = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  
  const hash = await walletClient.writeContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [PERMIT2, amount],
  });
  
  console.log(`Tx: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  
  console.log("\n✅ PERMIT2 approval created!");
  console.log("🟠 This will show with an orange PERMIT2 badge in the UI");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
