import { createWalletClient, http, createPublicClient, parseAbi, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0x7e59b413906136a39ae0e65032195f2791eb2cbb" as const;
const TEST_TOKEN = "0xcdcc10eccf0b5c29ad18a6bd87d3a6d64d2e3288" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("🧪 Testing EIP-7702 on Ethereum Sepolia\n");

  const account = privateKeyToAccount(process.env.DEMO_EOA_PK as `0x${string}`);
  const transport = http("https://ethereum-sepolia-rpc.publicnode.com");

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ]);

  console.log(`Account: ${account.address}`);
  console.log(`EvorDelegate: ${EVOR_DELEGATE}`);
  console.log(`TestToken: ${TEST_TOKEN}\n`);

  // Step 1: Create an approval
  console.log("1️⃣ Creating test approval...");
  const approveHash = await walletClient.writeContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [SPENDER_A, 1000000000000000000n], // 1 token
  });
  console.log(`Approve tx: ${approveHash}`);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  
  const allowanceBefore = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`✅ Allowance set to: ${allowanceBefore.toString()}\n`);

  // Step 2: EIP-7702 revoke
  console.log("2️⃣ Signing EIP-7702 authorization...");
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: EVOR_DELEGATE,
    chainId: sepolia.id,
    nonce: 0,
  });
  console.log(`✅ Signed\n`);

  console.log("3️⃣ Sending EIP-7702 revoke transaction...");
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  const calldata = encodeFunctionData({
    abi: evorAbi,
    functionName: "revokeERC20",
    args: [[TEST_TOKEN], [SPENDER_A]],
  });

  const revokeHash = await walletClient.sendTransaction({
    to: account.address, // TO ourselves (EIP-7702!)
    data: calldata,
    authorizationList: [authorization],
  });

  console.log(`📤 Tx: ${revokeHash}`);
  console.log(`🔗 https://sepolia.etherscan.io/tx/${revokeHash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: revokeHash });
  console.log(`✅ Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}, Status: ${receipt.status}`);
  console.log(`Events: ${receipt.logs.length}\n`);

  // Step 3: Check result
  console.log("4️⃣ Checking result...");
  const allowanceAfter = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  
  console.log(`Before: ${allowanceBefore.toString()}`);
  console.log(`After:  ${allowanceAfter.toString()}`);
  console.log(`\n${allowanceAfter === 0n ? '🎉 SUCCESS! Approval revoked!' : '❌ FAILED - Approval still exists'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
