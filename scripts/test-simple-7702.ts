import { createWalletClient, http, createPublicClient, parseAbi, encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const EVOR_DELEGATE = "0xefa7e04f73321a5d585de268a7846932e3d3ee42" as const; // WORKING
const TEST_TOKEN = "0x3f1bfb16a75277d5826d195506b011a79fd9626e" as const;
const SPENDER_A = "0x1111111111111111111111111111111111111111" as const;

async function main() {
  console.log("🧪 Testing EIP-7702 with detailed debugging\n");

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

  // Check allowance BEFORE
  const allowanceBefore = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`Allowance BEFORE: ${allowanceBefore.toString()}\n`);

  // Create authorization
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: EVOR_DELEGATE,
    chainId: baseSepolia.id,
    nonce: 0,
  });

  console.log("Authorization created:");
  console.log(JSON.stringify(authorization, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));

  // Encode the function call manually
  const evorAbi = parseAbi([
    "function revokeERC20(address[] tokens, address[] spenders) external",
  ]);

  const calldata = encodeFunctionData({
    abi: evorAbi,
    functionName: "revokeERC20",
    args: [[TEST_TOKEN], [SPENDER_A]],
  });

  console.log(`\nCalldata: ${calldata}`);

  // Send raw transaction
  console.log(`\nSending EIP-7702 transaction...`);
  const hash = await walletClient.sendTransaction({
    to: account.address, // TO ourselves!
    data: calldata,
    authorizationList: [authorization],
  });

  console.log(`📤 Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}, Status: ${receipt.status}`);
  console.log(`Logs: ${receipt.logs.length}`);

  // Check allowance AFTER
  const allowanceAfter = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SPENDER_A],
  });
  console.log(`\nAllowance AFTER: ${allowanceAfter.toString()}`);
  console.log(`Changed: ${allowanceBefore !== allowanceAfter ? 'YES ✅' : 'NO ❌'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
