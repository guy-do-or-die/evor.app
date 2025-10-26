import "dotenv/config";

import { createWalletClient, http, createPublicClient } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("Deploying EvorDelegate to Base Mainnet...\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_RPC || "https://mainnet.base.org");

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport,
  });

  const publicClient = createPublicClient({
    chain: base,
    transport,
  });

  console.log("Deploying from:", account.address);
  console.log("Chain: Base Mainnet (Chain ID: 8453)\n");

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Account balance: ${(Number(balance) / 1e18).toFixed(6)} ETH`);
  
  if (balance < 100000000000000n) { // 0.0001 ETH (~$0.20 - plenty for Base)
    console.error("❌ Insufficient balance! Need at least 0.0001 ETH for deployment.");
    process.exit(1);
  }

  // Read compiled contract
  const artifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/EvorDelegate.sol/EvorDelegate.json"), "utf8")
  );

  // Support address for tips
  const supportAddress = "0x830bc5551e429DDbc4E9Ac78436f8Bf13Eca8434" as `0x${string}`;
  console.log("Support address:", supportAddress);

  console.log("\n🚀 Deploying EvorDelegate...");
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [supportAddress],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`\n✅ EvorDelegate deployed to: ${receipt.contractAddress}`);
  console.log(`\nAdd this to your .env file:`);
  console.log(`EVOR_DELEGATE_BASE=${receipt.contractAddress}`);
  console.log(`\nView on BaseScan: https://basescan.org/address/${receipt.contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
