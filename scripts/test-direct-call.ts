import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0x430cae04bdfc596be0ca98b46279c3babf080620" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("Testing direct call to EvorDelegate (without EIP-7702)...\n");

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

  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  console.log(`Calling EvorDelegate at ${EVOR_DELEGATE} directly...`);
  console.log(`This should work like a normal contract call\n`);

  try {
    const hash = await walletClient.writeContract({
      address: EVOR_DELEGATE, // Call the actual contract
      abi: evorAbi,
      functionName: "revokeERC20",
      args: [
        [TEST_TOKEN], // tokens array
        [SPENDER_A],  // spenders array  
      ],
    });

    console.log(`📤 Tx sent: ${hash}`);
    console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    console.log(`Status: ${receipt.status}`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
