import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const; // WORKING
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;
const SPENDER_B = "0x2222222222222222222222222222222222222222" as const;
const SPENDER_C = "0x3333333333333333333333333333333333333333" as const;

async function main() {
  console.log("🧪 Testing EIP-7702 Batch Approval Revocation on Base Sepolia\n");

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

  // Step 1: Create multiple test approvals
  console.log("1️⃣ Creating test approvals...");
  const spenders = [SPENDER_A, SPENDER_B, SPENDER_C];
  const amounts = [1000000000000000000n, 2000000000000000000n, 3000000000000000000n];

  for (let i = 0; i < spenders.length; i++) {
    const hash = await walletClient.writeContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenders[i], amounts[i]],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✅ Approved ${spenders[i]}: ${amounts[i].toString()}`);
  }

  // Check allowances BEFORE
  console.log("\n2️⃣ Allowances BEFORE revocation:");
  const beforeAllowances = [];
  for (const spender of spenders) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    beforeAllowances.push(allowance);
    console.log(`  ${spender}: ${allowance.toString()}`);
  }

  // Step 2: EIP-7702 batch revoke
  console.log("\n3️⃣ Signing EIP-7702 authorization...");
  const authorization = await walletClient.signAuthorization({
    contractAddress: EVOR_DELEGATE,
    executor: 'self', // KEY: Same account signs and executes!
  });
  console.log(`✅ Signed (nonce: ${authorization.nonce})\n`);

  console.log("4️⃣ Sending EIP-7702 BATCH revoke transaction...");
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  const hash = await walletClient.writeContract({
    abi: evorAbi,
    address: account.address, // TO ourselves (EIP-7702!)
    authorizationList: [authorization],
    functionName: "revokeERC20",
    args: [
      [TEST_TOKEN, TEST_TOKEN, TEST_TOKEN], // 3 tokens
      spenders, // 3 spenders
    ],
  });

  console.log(`📤 Tx: ${hash}`);
  console.log(`🔗 https://sepolia.basescan.org/tx/${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}, Events: ${receipt.logs.length}`);

  // Check allowances AFTER
  console.log("\n5️⃣ Allowances AFTER revocation:");
  let allRevoked = true;
  for (const spender of spenders) {
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    console.log(`  ${spender}: ${allowance.toString()}`);
    if (allowance !== 0n) allRevoked = false;
  }

  console.log(`\n${allRevoked ? '🎉 SUCCESS! All approvals revoked in ONE transaction using EIP-7702!' : '❌ FAILED'}`);
  console.log(`\n📊 Summary: Revoked ${spenders.length} approvals in 1 transaction`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
