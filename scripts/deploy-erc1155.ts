import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🎨 Deploying TestERC1155 to Base Sepolia...\n");

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

  console.log("Deploying from:", account.address);

  // Deploy TestERC1155
  console.log("Deploying TestERC1155...");
  const erc1155Artifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/TestNFT.sol/TestERC1155.json"), "utf8")
  );

  const hash = await walletClient.deployContract({
    abi: erc1155Artifact.abi,
    bytecode: erc1155Artifact.bytecode as `0x${string}`,
    args: [],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ TestERC1155: ${receipt.contractAddress}`);
  
  console.log(`\n📝 Add to create-test-approvals-comprehensive.ts:`);
  console.log(`testNFT1155: "${receipt.contractAddress}",`);
  
  console.log(`\n🌐 BaseScan: https://sepolia.basescan.org/address/${receipt.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
