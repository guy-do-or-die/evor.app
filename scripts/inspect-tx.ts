import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import "dotenv/config";

async function main() {
  const txHash = process.argv[2] as `0x${string}`;
  
  if (!txHash) {
    console.error("Usage: tsx scripts/inspect-tx.ts <tx-hash>");
    process.exit(1);
  }

  console.log(`Inspecting transaction: ${txHash}\n`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com"),
  });

  // Get transaction details
  const tx = await publicClient.getTransaction({ hash: txHash });
  
  console.log("📋 Transaction Details:");
  console.log(`Type: ${tx.type}`);
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Value: ${tx.value}`);
  console.log(`Gas: ${tx.gas}`);
  console.log(`Nonce: ${tx.nonce}`);
  
  // Check for EIP-7702 authorization list
  const authList = (tx as any).authorizationList;
  
  if (authList && Array.isArray(authList) && authList.length > 0) {
    console.log(`\n✅ EIP-7702 Transaction Detected!`);
    console.log(`Authorization List (${authList.length} entries):`);
    authList.forEach((auth: any, i: number) => {
      console.log(`\n  [${i}] Authorization:`);
      console.log(`    Chain ID: ${auth.chainId}`);
      console.log(`    Address: ${auth.address}`);
      console.log(`    Nonce: ${auth.nonce}`);
      console.log(`    r: ${auth.r}`);
      console.log(`    s: ${auth.s}`);
      console.log(`    yParity: ${auth.yParity}`);
    });
  } else {
    console.log(`\n❌ No EIP-7702 Authorization List Found`);
    console.log(`This is a regular transaction (Type ${tx.type})`);
  }
  
  // Get transaction receipt
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  console.log(`\n📊 Transaction Receipt:`);
  console.log(`Status: ${receipt.status}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed}`);
  console.log(`Logs: ${receipt.logs.length}`);
  
  // Check if EOA has delegated code after this transaction
  const code = await publicClient.getCode({ address: tx.from });
  if (code && code !== '0x') {
    console.log(`\n🔗 EOA Code Status:`);
    console.log(`Address ${tx.from} has delegated code`);
    console.log(`Code length: ${code.length} bytes`);
  } else {
    console.log(`\n⚪ EOA Code Status:`);
    console.log(`Address ${tx.from} has no delegated code`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
