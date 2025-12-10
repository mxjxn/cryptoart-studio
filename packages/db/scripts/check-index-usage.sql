-- Check if the optimize indexes were created and are being used
-- Run this in Supabase SQL Editor to verify the migration worked

-- 1. Verify all indexes exist
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

-- 2. Check index usage statistics (how many times each index has been used)
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

-- 3. Check table sizes and index sizes
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) AS index_size
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

-- 4. Quick count of cache entries (to monitor cleanup effectiveness)
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






