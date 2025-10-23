import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0x430cae04bdfc596be0ca98b46279c3babf080620" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("🧪 Testing EIP-7702 on Base Sepolia\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http(process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org");

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport,
  });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`EvorDelegate: ${EVOR_DELEGATE}`);
  console.log(`TestToken: ${TEST_TOKEN}\n`);

  // Check current allowance
  console.log("1️⃣ Checking current allowance...");
  const beforeAllowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`  ${SPENDER_A}: ${beforeAllowance.toString()}`);

  if (beforeAllowance === 0n) {
    console.log("\n⚠️  No existing approval. Creating one...");
    const approveHash = await walletClient.writeContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [SPENDER_A, 1000000000000000000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`  ✅ Approved`);
  }

  // EIP-7702 revoke
  console.log("\n2️⃣ Signing EIP-7702 authorization...");
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
    executor: 'self', // KEY FIX!
  });
  console.log(`✅ Signed\n`);

  console.log("3️⃣ Sending EIP-7702 revoke transaction...");
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  const hash = await walletClient.writeContract({
    abi: evorAbi,
    address: account.address,
    authorizationList: [authorization],
    functionName: "revokeERC20",
    args: [[TEST_TOKEN], [SPENDER_A]],
  });

  console.log(`📤 Tx: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}, Events: ${receipt.logs.length}`);

  // Check result
  console.log("\n4️⃣ Checking result...");
  const afterAllowance = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  
  console.log(`Before: ${beforeAllowance.toString()}`);
  console.log(`After:  ${afterAllowance.toString()}`);
  console.log(`\n${afterAllowance === 0n ? '🎉 SUCCESS! EIP-7702 works on Base Sepolia!' : '❌ FAILED'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
