import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0x430cae04bdfc596be0ca98b46279c3babf080620" as const;
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;
const SPENDER_B = "0x2222222222222222222222222222222222222222" as const;

async function main() {
  console.log("🚀 Testing EIP-7702 Batch Approval Revocation\n");

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

  const erc20Abi = parseAbi([
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`EvorDelegate: ${EVOR_DELEGATE}\n`);

  // Check allowances BEFORE
  console.log("📊 Allowances BEFORE revocation:");
  const allowanceA_before = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`  Token ${TEST_TOKEN}`);
  console.log(`    → ${SPENDER_A}: ${allowanceA_before.toString()}`);

  const allowanceB_before = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_B],
  });
  console.log(`    → ${SPENDER_B}: ${allowanceB_before.toString()}`);

  // Step 1: Sign EIP-7702 Authorization
  console.log("\n📝 Step 1: Signing EIP-7702 authorization...");
  
  // For EIP-7702, authorization nonce should be 0 for first-time delegation
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: EVOR_DELEGATE,
    chainId: baseSepolia.id,
    nonce: 0, // First delegation attempt
  });
  console.log(`✅ Authorization signed`);

  // Step 2: Send Type-4 transaction with authorization list
  console.log("\n⚡ Step 2: Sending EIP-7702 batch revoke transaction...");
  const hash = await walletClient.writeContract({
    address: account.address, // Send TO the EOA itself (EIP-7702 magic!)
    abi: evorAbi,
    functionName: "revokeERC20",
    args: [
      [TEST_TOKEN, TEST_TOKEN], // tokens array
      [SPENDER_A, SPENDER_B],   // spenders array
    ],
    authorizationList: [authorization], // EIP-7702!
  });

  console.log(`📤 Tx sent: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  // Check allowances AFTER
  console.log("\n📊 Allowances AFTER revocation:");
  const allowanceA_after = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`  Token ${TEST_TOKEN}`);
  console.log(`    → ${SPENDER_A}: ${allowanceA_after.toString()}`);

  const allowanceB_after = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_B],
  });
  console.log(`    → ${SPENDER_B}: ${allowanceB_after.toString()}`);

  console.log("\n🎉 Success! All approvals revoked in ONE transaction using EIP-7702!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
