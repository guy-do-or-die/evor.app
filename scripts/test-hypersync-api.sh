#!/bin/bash

# Test HyperSync API on Vercel
echo "Testing HyperSync API on Vercel..."
echo ""

# Test request payload (minimal query)
PAYLOAD='{
  "from_block": 0,
  "to_block": 1,
  "logs": [],
  "field_selection": {
    "block": ["number", "timestamp"]
  }
}'

# Test Base Sepolia
echo "1. Testing Base Sepolia..."
curl -X POST \
  "https://evor.vercel.app/api/hypersync?chain=base-sepolia" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nStatus: %{http_code}\n" \
  -s | head -n 20

echo ""
echo "2. Testing Sepolia..."
curl -X POST \
  "https://evor.vercel.app/api/hypersync?chain=sepolia" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\nStatus: %{http_code}\n" \
  -s | head -n 20

echo ""
echo "✅ API tests complete!"
