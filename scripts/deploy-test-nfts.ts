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
  console.log("🎨 Deploying Test NFT Contracts to Base Sepolia...\n");

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
  console.log("Chain: Base Sepolia\n");

  // Deploy TestERC721
  console.log("1️⃣ Deploying TestERC721...");
  const erc721Artifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/TestNFT.sol/TestERC721.json"), "utf8")
  );

  const erc721Hash = await walletClient.deployContract({
    abi: erc721Artifact.abi,
    bytecode: erc721Artifact.bytecode as `0x${string}`,
    args: [],
  });

  console.log("Deploy tx:", erc721Hash);
  const erc721Receipt = await publicClient.waitForTransactionReceipt({ hash: erc721Hash });
  console.log(`✅ TestERC721: ${erc721Receipt.contractAddress}`);

  // Deploy TestERC1155
  console.log("\n2️⃣ Deploying TestERC1155...");
  const erc1155Artifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/TestNFT.sol/TestERC1155.json"), "utf8")
  );

  const erc1155Hash = await walletClient.deployContract({
    abi: erc1155Artifact.abi,
    bytecode: erc1155Artifact.bytecode as `0x${string}`,
    args: [],
  });

  console.log("Deploy tx:", erc1155Hash);
  const erc1155Receipt = await publicClient.waitForTransactionReceipt({ hash: erc1155Hash });
  console.log(`✅ TestERC1155: ${erc1155Receipt.contractAddress}`);

  console.log("\n📋 Summary:");
  console.log(`TestERC721:  ${erc721Receipt.contractAddress}`);
  console.log(`TestERC1155: ${erc1155Receipt.contractAddress}`);
  
  console.log(`\n📝 Update create-test-approvals-comprehensive.ts with:`);
  console.log(`const NFT_COLLECTIONS = {`);
  console.log(`  testNFT721: "${erc721Receipt.contractAddress}",`);
  console.log(`  testNFT1155: "${erc1155Receipt.contractAddress}",`);
  console.log(`};`);
  
  console.log(`\n🌐 BaseScan Links:`);
  console.log(`https://sepolia.basescan.org/address/${erc721Receipt.contractAddress}`);
  console.log(`https://sepolia.basescan.org/address/${erc1155Receipt.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
