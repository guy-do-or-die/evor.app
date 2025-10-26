import { createWalletClient, http, createPublicClient, hexToSignature } from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const CHAIN_CONFIGS = {
  'sepolia': {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
    evorDelegate: "0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23", // New clean contract
    explorerUrl: "https://sepolia.etherscan.io",
  },
  'base-sepolia': {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC!,
    evorDelegate: "0x81bacfd7401e69328c0aa6501757e5e4137f0b14", // New clean contract
    explorerUrl: "https://sepolia.basescan.org",
  },
} as const;

type SupportedChain = keyof typeof CHAIN_CONFIGS;

async function main() {
  // Get chain from command line argument (e.g., --chain=sepolia)
  const chainArg = process.argv.find(arg => arg.startsWith('--chain='))?.split('=')[1] || 'sepolia';
  
  if (!(chainArg in CHAIN_CONFIGS)) {
    console.error(`❌ Unsupported chain: ${chainArg}`);
    console.error(`Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const chainKey = chainArg as SupportedChain;
  const config = CHAIN_CONFIGS[chainKey];
  
  console.log(`\n🔄 Re-delegating to clean EvorDelegate on ${config.chain.name}...\n`);
  console.log(`New clean contract: ${config.evorDelegate}\n`);

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(config.rpcUrl);

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport,
  });

  const publicClient = createPublicClient({
    chain: config.chain,
    transport,
  });

  console.log(`Account: ${account.address}`);
  console.log(`Chain: ${config.chain.name} (${config.chain.id})\n`);

  // Step 1: Check current delegation
  console.log("📋 Step 1: Checking current delegation...");
  const currentCode = await publicClient.getCode({ address: account.address });
  
  if (currentCode && currentCode !== '0x') {
    // Decode current delegation
    const currentDelegation = currentCode.slice(8, 48);
    console.log(`   Current delegation: 0x${currentDelegation}`);
  } else {
    console.log(`   No current delegation`);
  }

  // Step 2: Clear existing delegation
  console.log("\n🧹 Step 2: Clearing existing delegation...");
  
  const nonce1 = await publicClient.getTransactionCount({ 
    address: account.address,
    blockTag: 'pending'
  });
  
  // Create authorization to address(0) to clear delegation
  const clearTypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Authorization: [
        { name: 'chainId', type: 'uint256' },
        { name: 'address', type: 'address' },
        { name: 'nonce', type: 'uint64' },
      ],
    },
    primaryType: 'Authorization' as const,
    domain: {
      name: 'EIP-7702',
      version: '1',
      chainId: config.chain.id,
    },
    message: {
      chainId: config.chain.id,
      address: '0x0000000000000000000000000000000000000000', // Clear delegation
      nonce: Number(nonce1),
    },
  };
  
  console.log("   Signing clear authorization (delegate to address(0))...");
  const clearSignature = await account.signTypedData(clearTypedData);
  const clearSig = hexToSignature(clearSignature);
  const clearAuth = {
    chainId: config.chain.id,
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    nonce: Number(nonce1),
    ...clearSig,
  };
  
  console.log("   Sending clear delegation transaction...");
  const clearHash = await walletClient.sendTransaction({
    account: account.address,
    to: account.address,
    value: 0n,
    authorizationList: [clearAuth],
  } as any);
  
  console.log(`   Tx: ${clearHash}`);
  await publicClient.waitForTransactionReceipt({ hash: clearHash });
  console.log(`   ✅ Delegation cleared!`);

  // Step 3: Set new delegation
  console.log("\n🎯 Step 3: Delegating to new clean EvorDelegate...");
  
  const nonce2 = await publicClient.getTransactionCount({ 
    address: account.address,
    blockTag: 'pending'
  });
  
  const newTypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Authorization: [
        { name: 'chainId', type: 'uint256' },
        { name: 'address', type: 'address' },
        { name: 'nonce', type: 'uint64' },
      ],
    },
    primaryType: 'Authorization' as const,
    domain: {
      name: 'EIP-7702',
      version: '1',
      chainId: config.chain.id,
    },
    message: {
      chainId: config.chain.id,
      address: config.evorDelegate,
      nonce: Number(nonce2),
    },
  };
  
  console.log("   Signing new authorization...");
  const newSignature = await account.signTypedData(newTypedData);
  const newSig = hexToSignature(newSignature);
  const newAuth = {
    chainId: config.chain.id,
    address: config.evorDelegate as `0x${string}`,
    nonce: Number(nonce2),
    ...newSig,
  };
  
  console.log("   Sending delegation transaction...");
  const newHash = await walletClient.sendTransaction({
    account: account.address,
    to: account.address,
    value: 0n,
    authorizationList: [newAuth],
  } as any);
  
  console.log(`   Tx: ${newHash}`);
  await publicClient.waitForTransactionReceipt({ hash: newHash });
  console.log(`   ✅ Delegated to clean contract!`);

  // Step 4: Verify
  console.log("\n✅ Step 4: Verifying new delegation...");
  const finalCode = await publicClient.getCode({ address: account.address });
  
  if (finalCode && finalCode !== '0x') {
    const finalDelegation = `0x${finalCode.slice(8, 48)}`;
    console.log(`   New delegation: ${finalDelegation}`);
    
    if (finalDelegation.toLowerCase() === config.evorDelegate.toLowerCase()) {
      console.log(`   🎉 SUCCESS! Now delegated to clean EvorDelegate!`);
    } else {
      console.log(`   ⚠️  Warning: Delegation doesn't match expected address`);
    }
  } else {
    console.log(`   ❌ No delegation found`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Clear tx: ${config.explorerUrl}/tx/${clearHash}`);
  console.log(`   New delegation tx: ${config.explorerUrl}/tx/${newHash}`);
  console.log(`   Contract: ${config.explorerUrl}/address/${config.evorDelegate}`);
  console.log(`\n✅ Re-delegation complete!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
