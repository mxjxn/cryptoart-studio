-- Migration: Optimize Database Indexes for Reduced Disk IO
-- Purpose: Add composite indexes and optimize query patterns to dramatically reduce disk IO
-- Expected Impact: 15-25% reduction in disk IO from better index usage

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================

-- Notifications: Common query is user_address + read + created_at (for unread notifications sorted by date)
-- This composite index covers: WHERE user_address = ? AND read = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" USING btree ("user_address", "read", "created_at" DESC);

-- User Cache: Common query is checking expired entries for cleanup
-- This index covers: WHERE expires_at < NOW() for cleanup queries
CREATE INDEX IF NOT EXISTS "user_cache_expired_cleanup_idx" ON "user_cache" USING btree ("expires_at");

-- Contract Cache: Common query is checking expired entries for cleanup
CREATE INDEX IF NOT EXISTS "contract_cache_expired_cleanup_idx" ON "contract_cache" USING btree ("expires_at");

-- Follows: Common queries are follower/following lookups with ordering
-- These composite indexes cover joins and sorting in followers/following queries
CREATE INDEX IF NOT EXISTS "follows_follower_created_idx" ON "follows" USING btree ("follower_address", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "follows_following_created_idx" ON "follows" USING btree ("following_address", "created_at" DESC);

-- Favorites: User + listing lookup and ordering
CREATE INDEX IF NOT EXISTS "favorites_user_created_idx" ON "favorites" USING btree ("user_address", "created_at" DESC);

-- ============================================
-- JSONB INDEXES FOR VERIFIED WALLETS
-- ============================================

-- User Cache: JSONB index for verified_wallets array lookups (used in user resolution)
-- This is critical for queries like: WHERE verified_wallets @> '["0x..."]'
CREATE INDEX IF NOT EXISTS "user_cache_verified_wallets_gin_idx" ON "user_cache" USING gin ("verified_wallets");

-- ============================================
-- CLEANUP: Remove redundant single-column indexes
-- ============================================
-- Note: We keep the original single-column indexes for now since they may be used by other queries
-- Future optimization: Profile query usage and remove truly redundant indexes

-- ============================================
-- STATISTICS UPDATE
-- ============================================
-- Update table statistics to help the query planner make better decisions
ANALYZE "user_cache";
ANALYZE "contract_cache";
ANALYZE "notifications";
ANALYZE "follows";
ANALYZE "favorites";
