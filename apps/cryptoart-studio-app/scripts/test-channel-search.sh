#!/bin/bash

# Channel Cast Search API Test Script
# This script demonstrates the enhanced channel cast search functionality

BASE_URL="http://localhost:3000"
TEST_FID="4905"  # Replace with your actual FID

echo "🔍 Testing Enhanced Channel Cast Search API"
echo "=============================================="

# Test 1: Basic channel search
echo -e "\n1. Basic Channel Search (Farcaster channel)"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

# Test 2: Search with text filter
echo -e "\n2. Text Search (looking for 'crypto' in Farcaster channel)"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&searchText=crypto&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

# Test 3: Search with date range
echo -e "\n3. Date Range Search (last 30 days)"
START_DATE=$(date -d '30 days ago' '+%Y-%m-%d')
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&startDate=$START_DATE&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

# Test 4: Search for casts with links
echo -e "\n4. Filter for Casts with Links"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&hasLinks=true&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.castsWithLinks' 2>/dev/null || echo "❌ Failed"

# Test 5: Search for casts with images
echo -e "\n5. Filter for Casts with Images"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&hasImages=true&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.castsWithImages' 2>/dev/null || echo "❌ Failed"

# Test 6: Search for high-engagement casts
echo -e "\n6. High Engagement Casts (min 10 likes)"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&minLikes=10&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

# Test 7: Complex search with multiple filters
echo -e "\n7. Complex Search (text + images + engagement)"
curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&searchText=art&hasImages=true&minLikes=5&limit=5" \
  -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

# Test 8: Search with author filtering
echo -e "\n8. Author Filtering (replace with actual FIDs)"
echo "Note: Replace FIDs with actual user FIDs for testing"
# curl -s "$BASE_URL/api/data/channel-casts?channelId=farcaster&authorFids=123,456&limit=5" \
#   -H "x-farcaster-fid: $TEST_FID" | jq '.activityStats.totalCasts' 2>/dev/null || echo "❌ Failed"

echo -e "\n✅ Channel Cast Search API Tests Complete!"
echo "=============================================="
echo ""
echo "📚 For more examples and documentation, see:"
echo "   CHANNEL_CAST_SEARCH.md"
echo ""
echo "🔗 API Documentation:"
echo "   https://docs.neynar.com/reference/search-casts"
