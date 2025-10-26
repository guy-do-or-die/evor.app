import { createPublicClient, http } from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import "dotenv/config";

async function checkChain(chainName: string, chain: any, rpcUrl: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Checking ${chainName}`);
  console.log('='.repeat(60));
  
  const address = "0x7db7ec6721cd5c83624e6b628210799e0b561200" as `0x${string}`;
  
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    // Check if EOA has delegated code
    const code = await publicClient.getCode({ address });
    
    if (code && code !== '0x') {
      console.log(`✅ EOA has delegated code`);
      console.log(`   Address: ${address}`);
      console.log(`   Code length: ${code.length} bytes`);
      console.log(`   Code: ${code.slice(0, 66)}...`);
      
      // Try to find the EvorDelegate contract to compare
      const evorAddresses: Record<string, string> = {
        'Sepolia': '0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23',
        'Base Sepolia': '0x81bacfd7401e69328c0aa6501757e5e4137f0b14',
      };
      
      const evorAddress = evorAddresses[chainName];
      if (evorAddress) {
        const evorCode = await publicClient.getCode({ address: evorAddress as `0x${string}` });
        if (evorCode && evorCode !== '0x') {
          console.log(`\n   Comparing with EvorDelegate at ${evorAddress}:`);
          if (code === evorCode) {
            console.log(`   ✅ MATCH! EOA is delegated to EvorDelegate`);
          } else {
            console.log(`   ❌ Different code (delegated to something else)`);
          }
        }
      }
    } else {
      console.log(`⚪ EOA has no delegated code`);
      console.log(`   This is a normal EOA (not using EIP-7702)`);
    }
    
    // Get recent tx count
    const txCount = await publicClient.getTransactionCount({ address });
    console.log(`\n📊 Transaction count: ${txCount}`);
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log(`\n🔎 Checking EOA delegation status across chains...\n`);
  
  await checkChain('Sepolia', sepolia, process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com");
  await checkChain('Base Sepolia', baseSepolia, process.env.BASE_SEPOLIA_RPC || "");
  
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
