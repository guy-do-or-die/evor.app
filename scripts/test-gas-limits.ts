import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;

async function main() {
  console.log("🧮 Testing Gas Limits for Batch Revocations\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });
  const publicClient = createPublicClient({ chain: baseSepolia, transport });

  // Test different batch sizes
  const batchSizes = [1, 5, 10, 20, 50];

  for (const size of batchSizes) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing batch size: ${size}`);
    console.log('='.repeat(50));

    // Create arrays
    const tokens = Array(size).fill(TEST_TOKEN);
    const spenders = Array(size).fill("0x1111111111111111111111111111111111111111");

    console.log(`Array sizes: ${tokens.length} tokens, ${spenders.length} spenders`);

    // Estimate gas
    const evorAbi = parseAbi([
      "function revokeERC20(address[] tokens, address[] spenders) external",
    ]);

    try {
      const authorization = await walletClient.signAuthorization({
        contractAddress: EVOR_DELEGATE,
        executor: 'self',
      });

      const gasEstimate = await publicClient.estimateGas({
        account: account.address,
        to: account.address,
        data: walletClient.encodeFunctionData({
          abi: evorAbi,
          functionName: "revokeERC20",
          args: [tokens, spenders],
        }) as `0x${string}`,
        authorizationList: [authorization],
      });

      console.log(`✅ Estimated gas: ${gasEstimate.toLocaleString()}`);
      console.log(`   Gas per revoke: ${(Number(gasEstimate) / size).toFixed(0)}`);
      
      // Calculate theoretical max
      const blockGasLimit = 30_000_000; // Base/Ethereum block gas limit
      const maxRevokes = Math.floor(blockGasLimit / (Number(gasEstimate) / size));
      console.log(`   Theoretical max (30M gas block): ~${maxRevokes} revokes`);

    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('Summary');
  console.log('='.repeat(50));
  console.log('Factors limiting batch size:');
  console.log('1. Block gas limit: 30M gas (Base/Ethereum)');
  console.log('2. Per-call gas limit: 100k gas (our safety limit)');
  console.log('3. Calldata size: ~1.8MB theoretical max');
  console.log('4. Practical limit: ~200-300 revokes per transaction');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Error:", error);
    process.exit(1);
  });
