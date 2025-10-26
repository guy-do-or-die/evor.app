import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CONTRACTS = {
  sepolia: {
    address: '0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23',
    network: 'sepolia',
    explorer: 'https://sepolia.etherscan.io',
  },
  baseSepolia: {
    address: '0x81bacfd7401e69328c0aa6501757e5e4137f0b14',
    network: 'baseSepolia',
    explorer: 'https://sepolia.basescan.org',
  },
};

async function verifyContract(name: string, config: any) {
  console.log(`\n🔍 Verifying ${name} on ${config.network}...`);
  console.log(`Address: ${config.address}`);
  console.log(`Explorer: ${config.explorer}/address/${config.address}\n`);

  try {
    // EvorDelegate has no constructor arguments
    const command = `npx hardhat verify --network ${config.network} ${config.address}`;
    
    console.log(`Running: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
    
    console.log(`✅ Verified ${name}!`);
  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log(`✅ Already verified on ${config.network}!`);
    } else {
      console.error(`❌ Error verifying ${name}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting contract verification...\n');
  console.log('Contracts to verify:');
  console.log('1. EvorDelegate on Sepolia');
  console.log('2. EvorDelegate on Base Sepolia\n');

  await verifyContract('Sepolia EvorDelegate', CONTRACTS.sepolia);
  await verifyContract('Base Sepolia EvorDelegate', CONTRACTS.baseSepolia);

  console.log('\n✅ Verification complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
