#!/bin/bash

# Quick test script for database optimizations
# Usage: ./test-optimizations.sh

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testing Database Optimizations"
echo "📍 Testing against: $BASE_URL"
echo ""

# Test 1: Cache Headers
echo "1️⃣  Testing Cache Headers..."
echo "   /api/auctions/active:"
CACHE_ACTIVE=$(curl -s -I "$BASE_URL/api/auctions/active" | grep -i "cache-control" || echo "❌ No Cache-Control header")
echo "      $CACHE_ACTIVE"

echo "   /api/listings/browse:"
CACHE_BROWSE=$(curl -s -I "$BASE_URL/api/listings/browse" | grep -i "cache-control" || echo "❌ No Cache-Control header")
echo "      $CACHE_BROWSE"
echo ""

# Test 2: Cleanup Endpoint
echo "2️⃣  Testing Cleanup Endpoint..."
CLEANUP_RESPONSE=$(curl -s "$BASE_URL/api/cron/cleanup-cache")
if echo "$CLEANUP_RESPONSE" | grep -q "success"; then
  echo "   ✅ Cleanup endpoint working"
  echo "$CLEANUP_RESPONSE" | jq . 2>/dev/null || echo "$CLEANUP_RESPONSE"
else
  echo "   ❌ Cleanup endpoint error:"
  echo "$CLEANUP_RESPONSE"
fi
echo ""

# Test 3: Response Times
echo "3️⃣  Testing Response Times..."
echo "   First request (cold):"
time curl -s "$BASE_URL/api/auctions/active" > /dev/null 2>&1
echo "   Second request (should be cached):"
time curl -s "$BASE_URL/api/auctions/active" > /dev/null 2>&1
echo ""

# Test 4: Verify endpoints return 200
echo "4️⃣  Testing Endpoint Availability..."
ENDPOINTS=(
  "/api/auctions/active"
  "/api/listings/browse"
  "/api/cron/cleanup-cache"
)

for endpoint in "${ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  if [ "$STATUS" = "200" ]; then
    echo "   ✅ $endpoint (200)"
  else
    echo "   ❌ $endpoint ($STATUS)"
  fi
done
echo ""

echo "✅ Quick tests complete!"
echo ""
echo "💡 For detailed testing, see TESTING_OPTIMIZATIONS.md"

