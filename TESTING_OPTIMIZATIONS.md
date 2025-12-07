# Testing Database Optimizations - Local Checklist

## Prerequisites

- [ ] Run the database migration: `cd packages/db && pnpm db:migrate-all` (or manually run `0005_optimize_indexes.sql`)
- [ ] Start your local dev server: `cd apps/mvp && npm run dev`
- [ ] Have a database monitoring tool ready (optional but helpful)

## Phase 1: Test API Caching (HTTP Cache-Control Headers)

### Test 1: Verify Cache Headers Are Set

```bash
# Test /api/auctions/active
curl -I http://localhost:3000/api/auctions/active

# Should see:
# Cache-Control: public, s-maxage=30, stale-while-revalidate=60

# Test /api/listings/browse
curl -I http://localhost:3000/api/listings/browse

# Should see:
# Cache-Control: public, s-maxage=30, stale-while-revalidate=60

# Test /api/user/[identifier] (replace with actual username/address)
curl -I http://localhost:3000/api/user/0xYourAddress

# Should see:
# Cache-Control: public, s-maxage=60, stale-while-revalidate=120
```

**Checklist:**
- [ ] `/api/auctions/active` returns `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`
- [ ] `/api/listings/browse` returns `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`
- [ ] `/api/user/[identifier]` returns `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`

### Test 2: Verify Cached Responses (Second Request)

```bash
# First request (should hit database)
time curl -s http://localhost:3000/api/auctions/active > /dev/null

# Second request (should be faster if cached)
time curl -s http://localhost:3000/api/auctions/active > /dev/null
```

**Checklist:**
- [ ] Second request is noticeably faster (or same speed if already fast)
- [ ] Response times are consistent

### Test 3: Test Cache Invalidation

```bash
# Make a request
curl http://localhost:3000/api/auctions/active > response1.json

# Wait 35 seconds (past s-maxage=30)
sleep 35

# Make another request
curl http://localhost:3000/api/auctions/active > response2.json

# Compare responses (should be same or updated)
diff response1.json response2.json
```

**Checklist:**
- [ ] Responses are cached for the expected duration
- [ ] Cache refreshes after expiration

## Phase 2: Test Database Indexes

### Test 1: Verify Indexes Were Created

```bash
# Connect to your database
psql $POSTGRES_URL

# Check if indexes exist
\di notifications_user_read_created_idx
\di user_cache_expired_cleanup_idx
\di contract_cache_expired_cleanup_idx
\di follows_follower_created_idx
\di follows_following_created_idx
\di favorites_user_created_idx
\di user_cache_verified_wallets_gin_idx

# Or query pg_indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%_idx'
ORDER BY tablename, indexname;
```

**Checklist:**
- [ ] All 7 indexes from `0005_optimize_indexes.sql` exist
- [ ] No errors when checking indexes

### Test 2: Test Query Performance (Before/After)

```bash
# Enable query timing in psql
\timing on

# Test notifications query (should use composite index)
EXPLAIN ANALYZE
SELECT * FROM notifications 
WHERE user_address = '0xYourAddress' 
AND read = false 
ORDER BY created_at DESC 
LIMIT 20;

# Test user cache lookup (should use verified_wallets index)
EXPLAIN ANALYZE
SELECT * FROM user_cache 
WHERE verified_wallets @> '["0xYourAddress"]'::jsonb;

# Test follows query (should use composite index)
EXPLAIN ANALYZE
SELECT * FROM follows 
WHERE follower_address = '0xYourAddress' 
ORDER BY created_at DESC;
```

**Checklist:**
- [ ] Queries show "Index Scan" or "Index Only Scan" in EXPLAIN output
- [ ] Query execution time is reasonable (< 50ms for indexed queries)
- [ ] No "Seq Scan" (sequential scan) on large tables

### Test 3: Monitor Database Activity

```bash
# In psql, check active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

# Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_idx'
ORDER BY idx_scan DESC;
```

**Checklist:**
- [ ] Indexes are being used (idx_scan > 0 after running queries)
- [ ] No long-running queries blocking the database

## Phase 3: Test Cleanup Cron Job

### Test 1: Verify Cleanup Endpoint Works

```bash
# Test the cleanup endpoint (should return stats)
curl http://localhost:3000/api/cron/cleanup-cache

# Should return JSON like:
# {
#   "success": true,
#   "userCacheDeleted": 0,
#   "contractCacheDeleted": 0,
#   "imageCacheDeleted": 0,
#   "notificationsDeleted": 0,
#   "duration": 123
# }
```

**Checklist:**
- [ ] Endpoint returns 200 status
- [ ] Response includes deletion counts
- [ ] No errors in response

### Test 2: Test Cleanup Logic (Create Expired Entries)

```bash
# In psql, create some expired cache entries for testing
INSERT INTO user_cache (eth_address, username, expires_at, cached_at)
VALUES 
  ('0xtest1', 'test1', NOW() - INTERVAL '1 day', NOW() - INTERVAL '31 days'),
  ('0xtest2', 'test2', NOW() - INTERVAL '1 day', NOW() - INTERVAL '31 days');

# Verify they exist
SELECT COUNT(*) FROM user_cache WHERE expires_at < NOW();

# Run cleanup
curl http://localhost:3000/api/cron/cleanup-cache

# Verify they were deleted
SELECT COUNT(*) FROM user_cache WHERE expires_at < NOW();
```

**Checklist:**
- [ ] Expired entries are created successfully
- [ ] Cleanup endpoint deletes expired entries
- [ ] Count goes from > 0 to 0 after cleanup

### Test 3: Test Authorization (if CRON_SECRET is set)

```bash
# Set CRON_SECRET in .env.local
echo 'CRON_SECRET=test-secret' >> apps/mvp/.env.local

# Restart dev server, then test without auth
curl http://localhost:3000/api/cron/cleanup-cache
# Should return 401 Unauthorized

# Test with auth
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/cleanup-cache
# Should return 200 OK
```

**Checklist:**
- [ ] Without auth: returns 401
- [ ] With correct auth: returns 200
- [ ] With wrong auth: returns 401

## Phase 4: Integration Testing

### Test 1: Load Test High-Traffic Routes

```bash
# Install Apache Bench if not installed
# macOS: brew install httpd
# Or use a simple loop

# Test /api/auctions/active with multiple requests
for i in {1..10}; do
  time curl -s http://localhost:3000/api/auctions/active > /dev/null
done

# Test /api/listings/browse
for i in {1..10}; do
  time curl -s http://localhost:3000/api/listings/browse > /dev/null
done
```

**Checklist:**
- [ ] Response times are consistent
- [ ] No errors under load
- [ ] Database connection pool doesn't exhaust

### Test 2: Monitor Database Connections

```bash
# In psql, check connection count
SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();

# Check for connection pool exhaustion
SELECT 
  state,
  count(*) as count,
  max(now() - query_start) as max_duration
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state;
```

**Checklist:**
- [ ] Connection count stays reasonable (< 20 for local dev)
- [ ] No "idle in transaction" connections
- [ ] No connection pool timeout errors

### Test 3: Test Real User Flows

**Checklist:**
- [ ] Homepage loads quickly (uses `/api/auctions/active`)
- [ ] Browse page loads quickly (uses `/api/listings/browse`)
- [ ] User profile loads quickly (uses `/api/user/[identifier]`)
- [ ] No infinite spinners
- [ ] No database timeout errors in console

## Phase 5: Performance Comparison

### Before/After Metrics

**Before (main branch):**
```bash
# Switch to main
git checkout main
npm run dev

# Record metrics
# - Average response time for /api/auctions/active
# - Database query count per page load
# - Connection pool usage
```

**After (optimize-database-usage branch):**
```bash
# Switch to optimize branch
git checkout copilot/optimize-database-usage
npm run dev

# Record same metrics
# - Average response time for /api/auctions/active
# - Database query count per page load
# - Connection pool usage
```

**Checklist:**
- [ ] Response times improved (or at least not worse)
- [ ] Database queries reduced (check server logs)
- [ ] Connection pool usage is lower
- [ ] No regressions in functionality

## Quick Verification Script

Save this as `test-optimizations.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Database Optimizations"
echo ""

echo "1. Testing Cache Headers..."
echo "   /api/auctions/active:"
curl -s -I http://localhost:3000/api/auctions/active | grep -i cache-control
echo "   /api/listings/browse:"
curl -s -I http://localhost:3000/api/listings/browse | grep -i cache-control
echo ""

echo "2. Testing Cleanup Endpoint..."
curl -s http://localhost:3000/api/cron/cleanup-cache | jq .
echo ""

echo "3. Testing Response Times..."
echo "   First request:"
time curl -s http://localhost:3000/api/auctions/active > /dev/null
echo "   Second request (cached):"
time curl -s http://localhost:3000/api/auctions/active > /dev/null
echo ""

echo "✅ Tests complete!"
```

Make it executable: `chmod +x test-optimizations.sh`
Run it: `./test-optimizations.sh`

## Success Criteria

✅ **All tests pass:**
- Cache headers are set correctly
- Indexes exist and are being used
- Cleanup endpoint works
- No database connection pool exhaustion
- Response times are acceptable
- No functionality regressions

## Troubleshooting

**If cache headers aren't showing:**
- Check that you're on the `copilot/optimize-database-usage` branch
- Verify the route handlers have the Cache-Control headers
- Check browser dev tools Network tab (not curl -I)

**If indexes aren't being used:**
- Verify migration was run: `SELECT * FROM pg_indexes WHERE indexname LIKE '%_idx'`
- Check query plans with EXPLAIN ANALYZE
- Ensure table statistics are updated: `ANALYZE table_name;`

**If cleanup doesn't work:**
- Check database connection
- Verify expired entries exist: `SELECT * FROM user_cache WHERE expires_at < NOW()`
- Check server logs for errors

