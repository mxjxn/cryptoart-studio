# Supabase PostgreSQL Setup Guide

This guide walks you through setting up Supabase PostgreSQL for the cryptoart-studio-app deployment on Vercel.

## Overview

Supabase provides managed PostgreSQL databases that work seamlessly with Vercel. This replaces the Docker-hosted PostgreSQL on Hostinger.

## Step 1: Create a Supabase Project

1. **Sign up/Login** to [Supabase](https://supabase.com)
2. **Create a new project**:
   - Click "New Project"
   - Choose your organization
   - Enter project details:
     - **Name**: `cryptoart-studio` (or your preferred name)
     - **Database Password**: Create a strong password (save this securely)
     - **Region**: Choose closest to your users (recommended: US East or EU West)
     - **Pricing Plan**: Start with Free tier, upgrade if needed
3. **Wait for provisioning** (usually takes 1-2 minutes)

## Step 2: Get Connection Strings

1. **Navigate to Project Settings**:
   - Click on your project
   - Go to **Settings** → **Database**

2. **Find Connection Strings**:
   - Scroll to "Connection string" section
   - You'll see several options:
     - **URI** (direct connection)
     - **Connection Pooling** (recommended for Vercel)

3. **Copy the Pooled Connection String**:
   - Select **"Connection Pooling"** mode
   - Choose **"Session"** pooling mode (best for Next.js)
   - Copy the connection string - it will look like:
     ```
     postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```

## Step 3: Configure Environment Variables

### For Vercel Deployment

Add the following environment variables in your Vercel project settings:

```bash
# Supabase PostgreSQL (Pooled - Recommended for Vercel)
POSTGRES_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Important Notes:**
- Replace `[project-ref]` with your Supabase project reference ID
- Replace `[password]` with your database password
- Replace `[region]` with your Supabase region (e.g., `us-east-1`)
- Use the **pooled connection string** for Vercel (port 6543)
- The `pgbouncer=true` parameter enables connection pooling

### Alternative: Direct Connection (for migrations only)

For running migrations locally, you may need the direct connection string:

```bash
# Direct connection (port 5432) - Use only for migrations, not in production
POSTGRES_URL_NON_POOLING=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Step 4: Run Database Migrations

1. **Set up local environment**:
   ```bash
   cd /path/to/cryptoart-monorepo
   ```

2. **Create `.env.local`** in the project root:
   ```bash
   POSTGRES_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

3. **Install dependencies** (if not already installed):
   ```bash
   pnpm install
   ```

4. **Run migrations**:
   ```bash
   pnpm db:push
   ```

   This will create all the required tables in your Supabase database.

5. **Verify tables were created**:
   - Go to Supabase Dashboard → **Table Editor**
   - You should see tables like:
     - `creator_core_contracts`
     - `creator_core_tokens`
     - `creator_core_transfers`
     - `subscriptions_cache`
     - `subscribers_cache`
     - And other required tables

## Step 5: Migrate Data (Optional)

If you have existing data in your Hostinger PostgreSQL database:

### Option 1: Use pg_dump and pg_restore

1. **Export from Hostinger**:
   ```bash
   pg_dump -h [hostinger-host] -U postgres -d cryptoart > dump.sql
   ```

2. **Import to Supabase**:
   ```bash
   psql -h db.[project-ref].supabase.co -U postgres -d postgres < dump.sql
   ```

### Option 2: Use Supabase CLI

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref [project-ref]
   ```

3. **Use migration tools**:
   ```bash
   supabase db push
   ```

### Option 3: Start Fresh (Recommended for testing)

If you're just testing or don't have critical data:
- Start with an empty database
- Let the indexer populate data over time
- This is simpler and ensures clean data

## Step 6: Verify Connection

1. **Test connection from local machine**:
   ```bash
   psql "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

2. **Or test via Supabase Dashboard**:
   - Go to **SQL Editor** in Supabase Dashboard
   - Run: `SELECT version();`

## Connection String Formats

### Pooled Connection (Recommended for Vercel)
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```
- **Port**: 6543 (connection pooler)
- **Use for**: Vercel deployments, production
- **Benefits**: Handles connection limits better, more efficient

### Direct Connection
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```
- **Port**: 5432 (direct PostgreSQL)
- **Use for**: Local migrations, admin tasks
- **Limitations**: Subject to connection limits

## Troubleshooting

### Connection Errors

**"Too many connections"**
- Use the pooled connection string (port 6543) instead of direct
- Ensure you're using `pgbouncer=true` parameter

**"Connection timeout"**
- Verify your IP is not blocked in Supabase Dashboard → Settings → Database → Connection Pooling
- Check firewall settings

**"Authentication failed"**
- Double-check your password
- Ensure the connection string format is correct
- Try resetting the database password in Supabase Dashboard

### Migration Issues

**"Table already exists"**
- Check if migrations were already run
- Use `pnpm db:push --force` to reset (⚠️ deletes all data)

**"Permission denied"**
- Ensure you're using the correct connection string with proper credentials
- Check Supabase project settings

## Security Best Practices

1. **Never commit connection strings** to Git
2. **Use environment variables** for all sensitive data
3. **Rotate passwords regularly** in Supabase Dashboard
4. **Use connection pooling** in production to prevent connection exhaustion
5. **Enable SSL** (Supabase connections are SSL by default)

## Next Steps

After setting up Supabase:
1. ✅ Add `POSTGRES_URL` to Vercel environment variables
2. ✅ Run migrations to create schema
3. ✅ Update your app to use the new database
4. ✅ Test the connection in production

For deployment instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

