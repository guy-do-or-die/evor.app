import "dotenv/config";

import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("Deploying EvorDelegate to Base Sepolia...");

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

  console.log("Deploying from:", account.address);

  // Read compiled contract
  const artifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/EvorDelegate.sol/EvorDelegate.json"), "utf8")
  );

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`✅ EvorDelegate deployed to: ${receipt.contractAddress}`);
  console.log(`\nAdd this to your .env file:`);
  console.log(`EVOR_DELEGATE=${receipt.contractAddress}`);
  console.log(`\nView on BaseScan: https://sepolia.basescan.org/address/${receipt.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
