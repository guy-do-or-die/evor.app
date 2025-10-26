import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = "FUAYW9WCW2HXG8VT78CHN9RC7V7H89I744";

const CONTRACTS = {
  sepolia: {
    address: '0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23',
    apiUrl: 'https://api-sepolia.etherscan.io/v2/api',
    explorer: 'https://sepolia.etherscan.io',
    chainId: 11155111,
  },
  baseSepolia: {
    address: '0x81bacfd7401e69328c0aa6501757e5e4137f0b14',
    apiUrl: 'https://api-sepolia.basescan.org/v2/api',
    explorer: 'https://sepolia.basescan.org',
    chainId: 84532,
  },
};

async function verifyContract(name: string, config: any) {
  console.log(`\n🔍 Verifying ${name}...`);
  console.log(`Address: ${config.address}`);
  console.log(`API: ${config.apiUrl}\n`);

  // Read the contract source
  const sourceCode = readFileSync(join(__dirname, '../contracts/EvorDelegate.sol'), 'utf8');

  // Prepare the verification request
  const params = new URLSearchParams({
    chainId: config.chainId.toString(),
    codeformat: 'solidity-single-file',
    sourceCode: sourceCode,
    contractaddress: config.address,
    contractname: 'contracts/EvorDelegate.sol:EvorDelegate',
    compilerversion: 'v0.8.24+commit.e11b9ed9',
    optimizationUsed: '1',
    runs: '200',
    evmversion: 'shanghai',
  });

  try {
    console.log('Submitting verification...');
    
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: params.toString(),
    });

    const text = await response.text();
    console.log('Raw response:', text);
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response as JSON');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      return;
    }
    
    console.log('Parsed response:', JSON.stringify(result, null, 2));

    if (result.status === '1' || result.message === 'OK') {
      console.log(`✅ Verification submitted for ${name}!`);
      console.log(`GUID: ${result.result}`);
      console.log(`\nCheck status at: ${config.explorer}/address/${config.address}#code`);
      
      // Wait a bit and check status
      if (result.result) {
        console.log('\nWaiting 10 seconds to check status...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await checkStatus(config, result.result);
      }
    } else {
      console.log(`⚠️ ${result.message || 'Verification failed'}`);
      if (result.result) {
        console.log(`Details: ${result.result}`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function checkStatus(config: any, guid: string) {
  const params = new URLSearchParams({
    chainId: config.chainId.toString(),
    guid: guid,
  });

  try {
    const response = await fetch(`${config.apiUrl}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    const result = await response.json();
    console.log('Status:', JSON.stringify(result, null, 2));
    
    if (result.result === 'Pass - Verified') {
      console.log('✅ Verification successful!');
    } else if (result.result === 'Pending in queue') {
      console.log('⏳ Still pending - check back in a minute');
    } else {
      console.log(`Status: ${result.result}`);
    }
  } catch (error: any) {
    console.error(`Error checking status: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Verifying contracts on Etherscan V2...\n');
  console.log('Using API Key:', API_KEY.substring(0, 10) + '...\n');

  await verifyContract('Ethereum Sepolia', CONTRACTS.sepolia);
  console.log('\n' + '='.repeat(70));
  await verifyContract('Base Sepolia', CONTRACTS.baseSepolia);

  console.log('\n✅ All verifications submitted!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
