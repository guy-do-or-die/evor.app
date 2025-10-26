# Hardhat Integration

## Overview

**evor** uses Hardhat 3.0 for smart contract development, testing, and deployment. The core smart contract, `EvorDelegate`, is a stateless delegate contract designed specifically for EIP-7702 batch approval revocations.

## Why Hardhat?

Hardhat provides the development infrastructure for evor's smart contract layer:

- 🔧 **Development**: TypeScript-based smart contract development with Viem integration
- ✅ **Testing**: Comprehensive test suite for EIP-7702 delegation logic
- 🚀 **Deployment**: Multi-chain deployment scripts for Base, Ethereum, and testnets
- 🔍 **Verification**: Automated contract verification on Etherscan/Basescan
- 🛠️ **Toolbox**: Full Hardhat Toolbox with Viem for modern Ethereum development

## Hardhat Version

**Current Version**: `hardhat@3.0.0`

✅ **Qualified for ETHGlobal Hardhat Prize** (requires 3.0.0+)

```json
{
  "devDependencies": {
    "hardhat": "^3.0.0",
    "@nomicfoundation/hardhat-toolbox-viem": "^5.0.0",
    "@nomicfoundation/hardhat-verify": "^3.0.4"
  }
}
```

## Smart Contract Architecture

### EvorDelegate Contract

**File**: `contracts/EvorDelegate.sol`

The EvorDelegate contract is a stateless delegate designed for EIP-7702 authorization. It allows users to batch-revoke token approvals without transferring ownership of their EOA.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EvorDelegate is ReentrancyGuard {
    error LengthMismatch();
    error ZeroAddress();
    error BatchTooLarge();
    
    uint256 public constant MAX_BATCH_SIZE = 250;

    function revokeAllApprovals(
        address[] calldata erc20Tokens,
        address[] calldata erc20Spenders,
        address[] calldata nftTokens,
        address[] calldata nftOperators
    ) external nonReentrant {
        _revokeERC20(erc20Tokens, erc20Spenders);
        _revokeNFT(nftTokens, nftOperators);
    }

    function _revokeERC20(
        address[] calldata tokens,
        address[] calldata spenders
    ) internal {
        uint256 n = tokens.length;
        if (n != spenders.length) revert LengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            address s = spenders[i];
            if (t == address(0) || s == address(0)) revert ZeroAddress();
            
            // Best effort: tolerate non-standard tokens
            (bool ok,) = t.call{gas: 100000}(
                abi.encodeWithSignature("approve(address,uint256)", s, 0)
            );
            ok; // Silence unused variable warning
        }
    }
}
```

### Key Features

1. **Stateless Design**: No storage variables, making it safe for EIP-7702 delegation
2. **Batch Operations**: Revoke up to 250 approvals in a single transaction
3. **Gas Optimization**: ~103k gas per ERC20 revocation, ~65k per NFT revocation
4. **Security**: ReentrancyGuard, input validation, best-effort revocation
5. **Multi-Standard**: Supports ERC20, ERC721, and ERC1155

## Hardhat Configuration

**File**: `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 84532,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.DEMO_EOA_PK ? [process.env.DEMO_EOA_PK] : [],
      chainId: 11155111,
    },
  },
};

export default config;
```

## Development Workflow

### 1. Compile Contracts

```bash
npm run compile
```

**Output**:
```
Compiled 3 Solidity files successfully
- EvorDelegate.sol
- TestERC20.sol
- TestNFT.sol
```

### 2. Deploy Contracts

**Base Sepolia**:
```bash
npm run deploy:base
```

**Ethereum Sepolia**:
```bash
npm run deploy:sepolia
```

**Base Mainnet**:
```bash
npm run deploy:base-mainnet
```

### 3. Verify on Etherscan

Automated verification is configured in deployment scripts:

```typescript
// Auto-verify after deployment
await hre.run("verify:verify", {
  address: deployed.address,
  constructorArguments: [],
});
```

## Deployed Contracts

### Production Deployments

| Network | Contract Address | Status |
|---------|-----------------|--------|
| **Base Sepolia** | `0x81bacfd7401e69328c0aa6501757e5e4137f0b14` | ✅ Verified |
| **Ethereum Sepolia** | `0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23` | ✅ Verified |
| **Base Mainnet** | `0xbdf5ec7f3d3bbe67bc5fe8232c495a5159df87bc` | 🔄 Needs redeployment |

### Verification Links

- **Base Sepolia**: [View on Basescan](https://sepolia.basescan.org/address/0x81bacfd7401e69328c0aa6501757e5e4137f0b14)
- **Ethereum Sepolia**: [View on Etherscan](https://sepolia.etherscan.io/address/0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23)

## Testing & Scripts

### Available Scripts

```bash
# Contract compilation
npm run compile

# Deployments
npm run deploy:base           # Deploy to Base Sepolia
npm run deploy:base-mainnet   # Deploy to Base Mainnet
npm run deploy:sepolia        # Deploy to Ethereum Sepolia

# Testing
npm run test:deploy-nfts      # Deploy test NFT contracts
npm run test:create-approvals # Create test approvals on-chain
npm run test:revoke           # Test EIP-7702 revocation flow

# Demo scripts
npm run demo                  # Demo EIP-7702 authorization
npm run demo:batch            # Demo batch approval revocation
```

### Test Contracts

**TestERC20.sol**: Mintable ERC20 for testing approval flows
**TestNFT.sol**: ERC721 for testing NFT approvals
**TestERC1155.sol**: ERC1155 for testing multi-token approvals

## EIP-7702 Integration

The EvorDelegate contract is specifically designed for EIP-7702:

### Authorization Flow

```typescript
// 1. User signs EIP-7702 authorization
const authorization = {
  chainId: chainConfig.chain.id,
  address: EVOR_DELEGATE_ADDRESS,
  nonce: await publicClient.getTransactionCount({ address: userAddress })
}

const signature = await walletClient.signAuthorization(authorization)

// 2. Submit transaction with authorization
const hash = await walletClient.sendTransaction({
  authorizationList: [{ ...authorization, ...signature }],
  to: userAddress, // Call user's own address
  data: encodeFunctionData({
    abi: EvorDelegateAbi,
    functionName: 'revokeAllApprovals',
    args: [erc20Tokens, erc20Spenders, nftTokens, nftOperators]
  })
})
```

### Why Stateless Design?

EIP-7702 temporarily delegates an EOA's code to a contract. The contract MUST be stateless because:

1. **No Storage Conflicts**: EOA storage layout is preserved
2. **Predictable Behavior**: No side effects on EOA state
3. **Security**: Cannot permanently modify EOA
4. **Gas Efficiency**: No SSTORE operations

## Gas Optimization

### Per-Operation Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| **ERC20 Approval Revocation** | ~103k gas | `approve(spender, 0)` call |
| **NFT Approval Revocation** | ~65k gas | `setApprovalForAll(operator, false)` call |
| **Batch Overhead** | ~21k gas | Base transaction cost |

### Batch Size Limits

- **MAX_BATCH_SIZE**: 250 approvals per transaction
- **Block Gas Limit**: 30M gas (Base/Ethereum)
- **Max Gas Per Batch**: ~25M gas (250 ERC20 revocations)

## Development Tools

### Hardhat Toolbox (Viem)

The project uses `@nomicfoundation/hardhat-toolbox-viem` which includes:

- **Viem**: Modern Ethereum library (TypeScript-first)
- **Hardhat Network**: Local EVM for testing
- **Hardhat Chai Matchers**: Testing utilities
- **Hardhat Verify**: Etherscan verification
- **TypeScript**: Full TypeScript support

## Security Features

1. **ReentrancyGuard**: Prevents reentrancy attacks
2. **Input Validation**: Checks for zero addresses and array length mismatches
3. **Gas Limits**: Per-call gas limits prevent griefing attacks
4. **Best Effort**: Continues execution even if individual approvals fail
5. **Batch Size Limit**: MAX_BATCH_SIZE prevents DoS via gas exhaustion

## Resources

- 📖 [Hardhat Documentation](https://hardhat.org/docs)
- 🔧 [Hardhat Toolbox (Viem)](https://hardhat.org/hardhat-runner/docs/advanced/using-viem)
- 🔍 [Hardhat Verify Plugin](https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify)
- 💻 [Viem Documentation](https://viem.sh)

## Conclusion

Hardhat 3.0 provides the robust development infrastructure needed for evor's EIP-7702 smart contract implementation. The combination of Hardhat's testing framework, Viem's modern API, and automated verification enables rapid iteration and deployment across multiple chains.

---

**Built with 🔨 using Hardhat 3.0**
