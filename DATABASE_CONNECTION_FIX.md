# Database Connection Pooling Fix

## Problem
The application was hitting "Max client connections reached" errors even with low traffic. This was caused by:
1. Each serverless function instance creating up to 10 database connections
2. Multiple instances running concurrently, quickly exhausting the database connection limit
3. Not using a proper global singleton pattern for Next.js serverless environments

## Solution
We've implemented:
1. **Global singleton pattern** - Ensures connection pool is shared across all serverless function invocations
2. **Reduced connection pool size** - From 10 to 2-3 connections per instance (2 for pooled connections, 3 for direct)
3. **Faster connection cleanup** - Idle connections close after 10 seconds (was 20)
4. **Connection string tracking** - Automatically recreates connection if connection string changes

## Required Environment Variable Changes

### ⚠️ CRITICAL: Use Pooled Connection String

You **MUST** use a **pooled connection string** in production. This is essential for serverless environments.

#### For Supabase (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to: **Settings → Database → Connection Pooling**
3. Copy the **Pooled Connection String** (port 6543)
4. It should look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

#### Set in Production (Vercel/Your Platform)

Set one of these environment variables (the app checks both):
- `STORAGE_POSTGRES_URL` (preferred for Supabase)
- `POSTGRES_URL` (fallback)

**Example:**
```bash
STORAGE_POSTGRES_URL=postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### ⚠️ DO NOT USE Direct Connection String

**Do NOT use the direct connection string** (port 5432) in production serverless environments. It will:
- Require IP allowlisting
- Create too many connections
- Hit connection limits quickly
- Cause timeouts

## How It Works Now

1. **First request**: Creates a connection pool with 2-3 connections
2. **Subsequent requests**: Reuses the same pool (global singleton)
3. **Idle connections**: Automatically closed after 10 seconds
4. **Connection errors**: Automatically reconnects

## Connection Pool Math

**Before:**
- 10 serverless instances × 10 connections = **100 connections** ❌

**After:**
- 10 serverless instances × 2 connections = **20 connections** ✅
- With Supabase pooler: Even better, as pooler handles multiplexing

## Testing

After deploying:
1. Monitor your database connection count
2. Check for "Max client connections" errors
3. Verify connection pool is being reused (check Supabase dashboard)

## Rollback

If you need to rollback, the old code had:
- `max: 10` connections per instance
- `idle_timeout: 20` seconds
- Module-level singleton (not global)

But **you still need the pooled connection string** even with the old code.

