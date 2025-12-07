#!/bin/bash

# Test script for deployed contracts API
# Usage: ./test-contracts-api.sh [address]

ADDRESS=${1:-"0x6da0a1784de1abdde1734ba37eca3d560bf044c0"}
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

