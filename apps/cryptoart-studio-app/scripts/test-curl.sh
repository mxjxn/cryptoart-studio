#!/bin/bash

# Creator Tools & Airdrop APIs - Quick curl Tests
# Run with: bash scripts/test-curl.sh

BASE_URL="http://localhost:3000"
TEST_FID="4905"  # Update this to your FID
TEST_TOKEN="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base
TEST_NFT="0x..."  # Update with actual NFT contract

echo "🚀 Testing Creator Tools & Airdrop APIs"
echo "📍 Base URL: $BASE_URL"
echo "👤 Test FID: $TEST_FID"
echo ""

# Test 1: Followers API
echo "📊 Testing Followers API..."
curl -s "$BASE_URL/api/data/followers?fid=$TEST_FID&limit=5" | jq '.followers | length' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 2: Channel Activity API
echo "📊 Testing Channel Activity API..."
curl -s "$BASE_URL/api/data/channel-activity?fid=$TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 3: Token Holders API
echo "📊 Testing Token Holders API..."
curl -s "$BASE_URL/api/data/token-holders?fids=$TEST_FID&tokenAddress=$TEST_TOKEN&minAmount=0" | jq '.totalHolders' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 4: NFT Holders API
echo "📊 Testing NFT Holders API..."
curl -s "$BASE_URL/api/data/nft-holders?fids=$TEST_FID&contractAddress=$TEST_NFT&minBalance=1" | jq '.totalHolders' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 5: Clanker Tokens API
echo "📊 Testing Clanker Tokens API..."
curl -s "$BASE_URL/api/data/clanker-tokens?fid=$TEST_FID" | jq '.totalTokens' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 6: Hypersub Members API
echo "📊 Testing Hypersub Members API..."
curl -s "$BASE_URL/api/data/hypersub-members?fids=$TEST_FID&contractAddress=0x..." | jq '.totalMembers' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 7: Bulk Query API
echo "📊 Testing Bulk Query API..."
curl -s -X POST "$BASE_URL/api/data/bulk-query" \
  -H "Content-Type: application/json" \
  -d "{
    \"fids\": [$TEST_FID],
    \"filters\": {
      \"token\": {
        \"tokenAddress\": \"$TEST_TOKEN\",
        \"minAmount\": \"0\"
      }
    }
  }" | jq '.matchingUsers' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 8: Lists API
echo "📋 Testing Lists API..."
curl -s "$BASE_URL/api/lists?fid=$TEST_FID" | jq '.totalLists' 2>/dev/null || echo "❌ Failed"
echo ""

# Test 9: Airdrop History API
echo "🎁 Testing Airdrop History API..."
curl -s "$BASE_URL/api/airdrop/history?fid=$TEST_FID&limit=5" | jq '.airdrops | length' 2>/dev/null || echo "❌ Failed"
echo ""

echo "✨ Quick tests completed!"
echo ""
echo "📝 To see full responses, run individual curl commands:"
echo "curl '$BASE_URL/api/data/followers?fid=$TEST_FID&limit=5' | jq"
echo ""
echo "📝 To test with real data, update TEST_FID and contract addresses in this script"
