import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

async function main() {
  console.log("🧹 Clearing EIP-7702 delegation...\n");

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

  console.log(`Account: ${account.address}\n`);

  // Sign authorization to zero address (clears delegation)
  console.log("📝 Signing authorization to zero address...");
  const clearAuth = await walletClient.signAuthorization({
    account,
    contractAddress: ZERO_ADDRESS,
  });
  console.log("✅ Clear authorization signed");

  // Send transaction with clear authorization
  console.log("\n⚡ Sending clear delegation transaction...");
  const hash = await walletClient.sendTransaction({
    to: account.address,
    authorizationList: [clearAuth],
    data: "0x", // No calldata needed
  });

  console.log(`📤 Tx sent: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  console.log("\n🎉 Delegation cleared! Your EOA is back to normal.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
