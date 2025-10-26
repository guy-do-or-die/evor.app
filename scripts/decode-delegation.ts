import { createPublicClient, http } from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import "dotenv/config";

function decodeDelegation(code: string): string | null {
  // EIP-7702 delegation code format:
  // 0xef0100 + 20 bytes (address)
  // The code is: ef01 00 <address>
  
  if (!code || code === '0x' || code.length < 48) {
    return null;
  }
  
  // Check if it starts with ef0100
  if (!code.startsWith('0xef0100')) {
    return null;
  }
  
  // Extract the address (20 bytes = 40 hex chars after ef0100)
  // 0xef0100 = 8 chars, then 40 chars for address
  const addressHex = code.slice(8, 48); // Get next 40 chars
  
  return `0x${addressHex}`;
}

async function checkChain(chainName: string, chain: any, rpcUrl: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Analyzing ${chainName}`);
  console.log('='.repeat(70));
  
  const address = "0x7db7ec6721cd5c83624e6b628210799e0b561200" as `0x${string}`;
  
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    // Get EOA code
    const code = await publicClient.getCode({ address });
    
    if (!code || code === '0x') {
      console.log(`⚪ EOA has no delegated code`);
      return;
    }
    
    console.log(`✅ EOA has delegated code`);
    console.log(`   Raw code: ${code}`);
    console.log(`   Code length: ${code.length} bytes\n`);
    
    // Decode the delegation
    const delegatedTo = decodeDelegation(code);
    
    if (delegatedTo) {
      console.log(`🎯 Delegated to contract: ${delegatedTo}`);
      
      // Try to get the contract code
      const contractCode = await publicClient.getCode({ address: delegatedTo as `0x${string}` });
      
      if (contractCode && contractCode !== '0x') {
        console.log(`   ✅ Contract exists`);
        console.log(`   Contract code size: ${contractCode.length} bytes`);
        
        // Compare with our known EvorDelegate addresses
        const evorAddresses: Record<string, string> = {
          'Sepolia': '0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23',
          'Base Sepolia': '0x81bacfd7401e69328c0aa6501757e5e4137f0b14',
        };
        
        const expectedEvr = evorAddresses[chainName]?.toLowerCase();
        const actualAddress = delegatedTo.toLowerCase();
        
        if (expectedEvr && actualAddress === expectedEvr) {
          console.log(`   🎉 This IS our new clean EvorDelegate!`);
        } else {
          console.log(`   ⚠️  This is NOT our new clean EvorDelegate`);
          console.log(`   Expected: ${evorAddresses[chainName]}`);
          console.log(`   Actual:   ${delegatedTo}`);
        }
        
        // Check Etherscan
        const explorerUrl = chain.id === 11155111 
          ? `https://sepolia.etherscan.io/address/${delegatedTo}`
          : `https://sepolia.basescan.org/address/${delegatedTo}`;
        console.log(`\n   🔗 View contract: ${explorerUrl}`);
      } else {
        console.log(`   ❌ Contract does not exist (might be deleted)`);
      }
    } else {
      console.log(`❌ Could not decode delegation address`);
    }
    
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log(`\n🔎 Decoding EIP-7702 Delegation...\n`);
  
  await checkChain('Sepolia', sepolia, process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com");
  await checkChain('Base Sepolia', baseSepolia, process.env.BASE_SEPOLIA_RPC || "");
  
  console.log(`\n${'='.repeat(70)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
