#!/bin/bash

# Test script for deployed contracts API
# Usage: ./test-contracts-api.sh [address]
# If no address provided, uses ADMIN_WALLET_ADDRESS env var or placeholder

ADDRESS=${1:-${ADMIN_WALLET_ADDRESS:-"0x0000000000000000000000000000000000000000"}}
URL="http://localhost:3000/api/contracts/deployed/${ADDRESS}"

echo "Testing deployed contracts API..."
echo "Address: ${ADDRESS}"
echo "URL: ${URL}"
echo ""
echo "Response:"
curl -s "${URL}" | jq '.'

echo ""
echo "---"
echo "Check your Next.js dev server logs above for detailed debugging info!"

