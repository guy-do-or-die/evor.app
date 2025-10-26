#!/bin/bash

# Etherscan API Key
API_KEY="FUAYW9WCW2HXG8VT78CHN9RC7V7H89I744"

# Read the compiled contract
BYTECODE=$(cat artifacts/contracts/EvorDelegate.sol/EvorDelegate.json | jq -r '.bytecode')
ABI=$(cat artifacts/contracts/EvorDelegate.sol/EvorDelegate.json | jq -c '.abi')
SOURCE_CODE=$(cat contracts/EvorDelegate.sol)

echo "🔍 Verifying contracts on block explorers..."
echo ""

# Verify on Sepolia
echo "1️⃣ Verifying on Ethereum Sepolia..."
echo "Address: 0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23"

curl -X POST "https://api-sepolia.etherscan.io/api" \
  -d "module=contract" \
  -d "action=verifysourcecode" \
  -d "apikey=$API_KEY" \
  -d "contractaddress=0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23" \
  -d "sourceCode=$SOURCE_CODE" \
  -d "codeformat=solidity-single-file" \
  -d "contractname=EvorDelegate" \
  -d "compilerversion=v0.8.24+commit.e11b9ed9" \
  -d "optimizationUsed=1" \
  -d "runs=200" \
  -d "constructorArguements=" \
  -d "evmversion=shanghai" \
  -d "licenseType=3"

echo ""
echo "✅ Sepolia verification submitted!"
echo "Check status at: https://sepolia.etherscan.io/address/0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23#code"
echo ""

# Verify on Base Sepolia
echo "2️⃣ Verifying on Base Sepolia..."
echo "Address: 0x81bacfd7401e69328c0aa6501757e5e4137f0b14"

curl -X POST "https://api-sepolia.basescan.org/api" \
  -d "module=contract" \
  -d "action=verifysourcecode" \
  -d "apikey=$API_KEY" \
  -d "contractaddress=0x81bacfd7401e69328c0aa6501757e5e4137f0b14" \
  -d "sourceCode=$SOURCE_CODE" \
  -d "codeformat=solidity-single-file" \
  -d "contractname=EvorDelegate" \
  -d "compilerversion=v0.8.24+commit.e11b9ed9" \
  -d "optimizationUsed=1" \
  -d "runs=200" \
  -d "constructorArguements=" \
  -d "evmversion=shanghai" \
  -d "licenseType=3"

echo ""
echo "✅ Base Sepolia verification submitted!"
echo "Check status at: https://sepolia.basescan.org/address/0x81bacfd7401e69328c0aa6501757e5e4137f0b14#code"
echo ""
echo "🎉 All verifications submitted! Check the links above to see the status."
