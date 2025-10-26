#!/bin/bash

API_KEY="FUAYW9WCW2HXG8VT78CHN9RC7V7H89I744"

# Read the contract source
SOURCE=$(cat contracts/EvorDelegate.sol | jq -Rs .)

echo "🔍 Verifying Sepolia contract..."
echo "Address: 0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23"
echo ""

# Verify on Sepolia using V1 API (sometimes still works)
curl -X POST "https://api-sepolia.etherscan.io/api" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "module=contract" \
  -d "action=verifysourcecode" \
  -d "apikey=$API_KEY" \
  -d "contractaddress=0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23" \
  -d "sourceCode=$SOURCE" \
  -d "codeformat=solidity-single-file" \
  -d "contractname=EvorDelegate" \
  -d "compilerversion=v0.8.24+commit.e11b9ed9" \
  -d "optimizationUsed=1" \
  -d "runs=200" \
  -d "constructorArguements=" \
  -d "evmversion=shanghai" \
  -d "licenseType=3"

echo ""
echo ""
echo "======================================================================"
echo ""
echo "🔍 Verifying Base Sepolia contract..."
echo "Address: 0x81bacfd7401e69328c0aa6501757e5e4137f0b14"
echo ""

# Verify on Base Sepolia
curl -X POST "https://api-sepolia.basescan.org/api" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "module=contract" \
  -d "action=verifysourcecode" \
  -d "apikey=$API_KEY" \
  -d "contractaddress=0x81bacfd7401e69328c0aa6501757e5e4137f0b14" \
  -d "sourceCode=$SOURCE" \
  -d "codeformat=solidity-single-file" \
  -d "contractname=EvorDelegate" \
  -d "compilerversion=v0.8.24+commit.e11b9ed9" \
  -d "optimizationUsed=1" \
  -d "runs=200" \
  -d "constructorArguements=" \
  -d "evmversion=shanghai" \
  -d "licenseType=3"

echo ""
echo ""
echo "✅ Verification requests submitted!"
echo ""
echo "Check status:"
echo "  Sepolia: https://sepolia.etherscan.io/address/0xd9ee9b61071b339ac3ae5a86eb139a1f36ab6b23#code"
echo "  Base Sepolia: https://sepolia.basescan.org/address/0x81bacfd7401e69328c0aa6501757e5e4137f0b14#code"
