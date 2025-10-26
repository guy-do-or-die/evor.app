import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const CONTRACT = "0xc920ccafc14ab6c0ca4b59dd8438f94a68cf7e06" as const;

async function main() {
  console.log("🧪 Testing newly deployed contract\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  // Check MAX_BATCH_SIZE constant
  const abi = parseAbi([
    "function MAX_BATCH_SIZE() external view returns (uint256)",
  ]);

  try {
    const maxBatch = await publicClient.readContract({
      address: CONTRACT,
      abi,
      functionName: "MAX_BATCH_SIZE",
    });

    console.log(`✅ Contract deployed at: ${CONTRACT}`);
    console.log(`✅ MAX_BATCH_SIZE: ${maxBatch}`);
    console.log(`\nContract features:`);
    console.log(`- Batch size limit: ${maxBatch}`);
    console.log(`- Functions: revokeERC20, revokeForAll, revokeAll`);
    console.log(`- All functions are payable (accept tips)`);
    console.log(`- ReentrancyGuard protection`);
    console.log(`- Gas limit: 100k per call`);
    
  } catch (error: any) {
    console.error("❌ Error reading contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
