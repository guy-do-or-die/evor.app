import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import "dotenv/config";

async function main() {
  const address = process.argv[2] as `0x${string}` || "0x7db7ec6721cd5c83624e6b628210799e0b561200";
  
  console.log(`Searching for EIP-7702 transactions from: ${address}\n`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com"),
  });

  // Get current block
  const currentBlock = await publicClient.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  // Get transaction count to know how many txs to check
  const txCount = await publicClient.getTransactionCount({ address });
  console.log(`Total transactions from address: ${txCount}\n`);
  console.log(`Scanning last 100 blocks for EIP-7702 transactions...\n`);
  
  // Scan last 100 blocks for transactions from this address
  const startBlock = currentBlock - 100n;
  let found = 0;
  
  for (let i = currentBlock; i >= startBlock && i > 0n; i--) {
    try {
      const block = await publicClient.getBlock({ 
        blockNumber: i,
        includeTransactions: true 
      });
      
      for (const tx of block.transactions) {
        if (typeof tx === 'object' && tx.from.toLowerCase() === address.toLowerCase()) {
          const authList = (tx as any).authorizationList;
          
          if (authList && Array.isArray(authList) && authList.length > 0) {
            found++;
            console.log(`\n🎯 Found EIP-7702 Transaction #${found}:`);
            console.log(`Block: ${block.number}`);
            console.log(`Hash: ${tx.hash}`);
            console.log(`Type: ${tx.type}`);
            console.log(`From: ${tx.from}`);
            console.log(`To: ${tx.to}`);
            console.log(`Nonce: ${tx.nonce}`);
            console.log(`\n📋 Authorization List (${authList.length} entries):`);
            
            authList.forEach((auth: any, idx: number) => {
              console.log(`\n  [${idx}] Authorization:`);
              console.log(`    Chain ID: ${auth.chainId}`);
              console.log(`    Delegate Address: ${auth.address}`);
              console.log(`    Nonce: ${auth.nonce}`);
            });
            
            console.log(`\n🔗 View on Etherscan:`);
            console.log(`https://sepolia.etherscan.io/tx/${tx.hash}`);
          }
        }
      }
      
      // Progress indicator every 10 blocks
      if (i % 10n === 0n) {
        process.stdout.write(`Scanned up to block ${i}...\r`);
      }
    } catch (error) {
      // Skip blocks that might not exist or have issues
      continue;
    }
  }
  
  if (found === 0) {
    console.log(`\n❌ No EIP-7702 transactions found in last 100 blocks`);
    console.log(`\nTry checking earlier blocks or a different address.`);
  } else {
    console.log(`\n\n✅ Found ${found} EIP-7702 transaction(s)!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
