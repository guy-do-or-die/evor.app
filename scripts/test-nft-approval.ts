import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

async function main() {
  console.log("Testing single NFT approval...\n");

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

  const nftAbi = parseAbi([
    "function setApprovalForAll(address operator, bool approved) external",
    "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  ]);

  const collection = "0x155ddba78142261e2a4bc18d114b92351fc5d649";
  const operator = "0x2222222222222222222222222222222222222222";

  console.log(`Account: ${account.address}`);
  console.log(`Collection: ${collection}`);
  console.log(`Operator: ${operator}\n`);

  // Check current approval
  const isApproved = await publicClient.readContract({
    address: collection as `0x${string}`,
    abi: nftAbi,
    functionName: "isApprovedForAll",
    args: [account.address, operator],
  });
  console.log(`Currently approved: ${isApproved}\n`);

  try {
    console.log("Sending setApprovalForAll transaction...");
    
    const hash = await walletClient.writeContract({
      address: collection as `0x${string}`,
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [operator, true],
      gas: 100000n,
    });

    console.log(`✅ Tx hash: ${hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed! Block: ${receipt.blockNumber}`);

    // Check again
    const newApproval = await publicClient.readContract({
      address: collection as `0x${string}`,
      abi: nftAbi,
      functionName: "isApprovedForAll",
      args: [account.address, operator],
    });
    console.log(`\nNow approved: ${newApproval}`);

  } catch (error: any) {
    console.error("\n❌ Error details:");
    console.error(`Message: ${error.message}`);
    console.error(`Short message: ${error.shortMessage}`);
    console.error(`Details: ${error.details}`);
    console.error(`\nFull error:`, error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
