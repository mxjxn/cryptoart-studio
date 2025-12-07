-- Diagnose why indexes aren't being used
-- Run these queries in Supabase SQL Editor

-- 1. Check if indexes exist and their definitions
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

-- 2. Check current index usage (might be 0 if queries haven't run or are cached)
SELECT 
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname IN (
    'notifications_user_read_created_idx',
    'user_cache_expired_cleanup_idx',
    'contract_cache_expired_cleanup_idx',
    'follows_follower_created_idx',
    'follows_following_created_idx',
    'favorites_user_created_idx',
    'user_cache_verified_wallets_gin_idx'
  )
ORDER BY idx_scan DESC;

-- 3. Test if query planner would use the index (replace with actual address from your DB)
-- This simulates the notifications query
EXPLAIN ANALYZE
SELECT * FROM notifications 
WHERE user_address = (SELECT user_address FROM notifications LIMIT 1)
  AND read = false 
ORDER BY created_at DESC 
LIMIT 20;

-- 4. Test verified_wallets GIN index (replace with actual address)
EXPLAIN ANALYZE
SELECT * FROM user_cache 
WHERE verified_wallets @> '["0x0000000000000000000000000000000000000000"]'::jsonb;

-- 5. Test follows index
EXPLAIN ANALYZE
SELECT * FROM follows 
WHERE follower_address = (SELECT follower_address FROM follows LIMIT 1)
ORDER BY created_at DESC;

-- 6. Force update statistics (this helps query planner make better decisions)
ANALYZE notifications;
ANALYZE user_cache;
ANALYZE contract_cache;
ANALYZE follows;
ANALYZE favorites;

-- 7. Check table sizes (small tables might not use indexes)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  (SELECT COUNT(*) FROM pg_stat_user_tables WHERE relid = c.oid) AS row_count_estimate
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN (
    'notifications',
    'user_cache',
    'contract_cache',
    'follows',
    'favorites'
  )
ORDER BY pg_total_relation_size(c.oid) DESC;

