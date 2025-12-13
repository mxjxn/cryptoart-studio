#!/bin/bash
# Script to cancel listing 6 using Foundry cast
# 
# Usage: ./scripts/cancel-listing-6.sh [PRIVATE_KEY] [RPC_URL]
# 
# If PRIVATE_KEY is not provided, cast will prompt for it
# If RPC_URL is not provided, defaults to Base mainnet public RPC

MARKETPLACE_ADDRESS="0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9"
LISTING_ID=6
HOLDBACK_BPS=0  # 0 for regular cancellation, can be up to 1000 for admin with holdback

# Base mainnet RPC (default)
RPC_URL="${2:-https://mainnet.base.org}"

# Function signature: cancel(uint40 listingId, uint16 holdbackBPS)
# We need to encode: cancel(6, 0)

echo "Cancelling listing $LISTING_ID..."
echo "Marketplace: $MARKETPLACE_ADDRESS"
echo "Chain: Base Mainnet (8453)"
echo ""

if [ -z "$1" ]; then
  echo "No private key provided. Cast will prompt for wallet interaction."
  echo ""
  cast send "$MARKETPLACE_ADDRESS" \
    "cancel(uint40,uint16)" \
    "$LISTING_ID" \
    "$HOLDBACK_BPS" \
    --rpc-url "$RPC_URL" \
    --chain base
else
  PRIVATE_KEY="$1"
  cast send "$MARKETPLACE_ADDRESS" \
    "cancel(uint40,uint16)" \
    "$LISTING_ID" \
    "$HOLDBACK_BPS" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --chain base
fi

