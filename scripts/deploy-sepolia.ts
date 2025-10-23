import { createWalletClient, http, createPublicClient } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("Deploying to Ethereum Sepolia...\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com");

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  console.log("Deploying from:", account.address);
  console.log("Chain: Ethereum Sepolia\n");

  // Deploy EvorDelegate
  console.log("1️⃣ Deploying EvorDelegate...");
  const evorArtifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/EvorDelegate.sol/EvorDelegate.json"), "utf8")
  );

  const evorHash = await walletClient.deployContract({
    abi: evorArtifact.abi,
    bytecode: evorArtifact.bytecode as `0x${string}`,
  });

  console.log("Deploy tx:", evorHash);
  const evorReceipt = await publicClient.waitForTransactionReceipt({ hash: evorHash });
  console.log(`✅ EvorDelegate: ${evorReceipt.contractAddress}`);

  // Deploy TestERC20
  console.log("\n2️⃣ Deploying TestERC20...");
  const tokenArtifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/TestERC20.sol/TestERC20.json"), "utf8")
  );

  const tokenHash = await walletClient.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode as `0x${string}`,
  });

  console.log("Deploy tx:", tokenHash);
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
  console.log(`✅ TestERC20: ${tokenReceipt.contractAddress}`);

  console.log("\n📋 Summary:");
  console.log(`EvorDelegate: ${evorReceipt.contractAddress}`);
  console.log(`TestERC20: ${tokenReceipt.contractAddress}`);
  console.log(`\nEtherscan Links:`);
  console.log(`https://sepolia.etherscan.io/address/${evorReceipt.contractAddress}`);
  console.log(`https://sepolia.etherscan.io/address/${tokenReceipt.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
