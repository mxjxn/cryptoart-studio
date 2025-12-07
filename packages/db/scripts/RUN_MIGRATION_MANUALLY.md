# Alternative: Run Migration Manually via Supabase SQL Editor

If the migration script is timing out due to connection pool exhaustion, you can run it manually through the Supabase SQL Editor.

## Steps:

1. **Go to Supabase Dashboard** → Your Project → **SQL Editor**

2. **Copy and paste the SQL from** `packages/db/migrations/0005_optimize_indexes.sql`

3. **Run it** - The SQL Editor uses a direct connection and won't hit pool limits

## Or Run Individual Indexes:

If the full migration times out, you can run indexes one at a time:

```sql
-- Run these one at a time in Supabase SQL Editor

-- 1. Notifications index
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" USING btree ("user_address", "read", "created_at" DESC);

-- 2. User cache cleanup index
CREATE INDEX IF NOT EXISTS "user_cache_expired_cleanup_idx" ON "user_cache" USING btree ("expires_at");

-- 3. Contract cache cleanup index
CREATE INDEX IF NOT EXISTS "contract_cache_expired_cleanup_idx" ON "contract_cache" USING btree ("expires_at");

-- 4. Follows indexes
CREATE INDEX IF NOT EXISTS "follows_follower_created_idx" ON "follows" USING btree ("follower_address", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "follows_following_created_idx" ON "follows" USING btree ("following_address", "created_at" DESC);

-- 5. Favorites index
CREATE INDEX IF NOT EXISTS "favorites_user_created_idx" ON "favorites" USING btree ("user_address", "created_at" DESC);

-- 6. User cache verified wallets GIN index
CREATE INDEX IF NOT EXISTS "user_cache_verified_wallets_gin_idx" ON "user_cache" USING gin ("verified_wallets");

-- 7. Update statistics (run these after indexes are created)
ANALYZE "user_cache";
ANALYZE "contract_cache";
ANALYZE "notifications";
ANALYZE "follows";
ANALYZE "favorites";
```

## Verify Indexes Were Created:

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%_idx'
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

