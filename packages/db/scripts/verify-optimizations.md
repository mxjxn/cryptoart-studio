# Verify Database Optimizations

Quick SQL queries to verify the optimizations are working in production.

## Run in Supabase SQL Editor

### 1. Verify Indexes Exist

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND indexname IN (
    'notifications_user_read_created_idx',
    'user_cache_expired_cleanup_idx',
    'contract_cache_expired_cleanup_idx',
    'follows_follower_created_idx',
    'follows_following_created_idx',
    'favorites_user_created_idx',
    'user_cache_verified_wallets_gin_idx'
  )
ORDER BY tablename, indexname;
```

**Expected:** Should return 7 rows, one for each index.

### 2. Check Index Usage (Are They Being Used?)

```sql
SELECT 
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE '%_idx'
ORDER BY idx_scan DESC;
```

**Expected:** After some traffic, `idx_scan` should be > 0 for the new indexes, indicating they're being used by queries.

### 3. Test Query Performance

```sql
-- Test notifications query (should use composite index)
EXPLAIN ANALYZE
SELECT * FROM notifications 
WHERE user_address = '0x0000000000000000000000000000000000000000' 
AND read = false 
ORDER BY created_at DESC 
LIMIT 20;
```

**Expected:** Should show "Index Scan using notifications_user_read_created_idx" instead of "Seq Scan".

### 4. Check Cache Table Sizes

```sql
SELECT 
  'user_cache' AS table_name,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_entries
FROM user_cache
UNION ALL
SELECT 
  'contract_cache' AS table_name,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_entries
FROM contract_cache
UNION ALL
SELECT 
  'image_cache' AS table_name,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_entries
FROM image_cache;
```

**Expected:** Monitor over time - expired entries should be cleaned up by the cron job.

## Quick Status Check

Run `check-index-usage.sql` in Supabase SQL Editor for a comprehensive report.




