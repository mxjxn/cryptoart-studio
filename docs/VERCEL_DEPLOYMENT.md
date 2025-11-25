# Vercel Deployment Guide

Complete guide for deploying cryptoart-studio-app to Vercel using Turborepo.

## Prerequisites

- Vercel account ([sign up](https://vercel.com))
- Supabase account for PostgreSQL ([sign up](https://supabase.com))
- Upstash account for Redis (already configured)
- Git repository (GitHub, GitLab, or Bitbucket)

## Overview

This guide covers:
1. Setting up Supabase PostgreSQL
2. Configuring Vercel project for Turborepo
3. Setting environment variables
4. Running database migrations
5. Deploying the application

## Step 1: Set Up Supabase PostgreSQL

Follow the complete guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to:
- Create a Supabase project
- Get your connection strings
- Run database migrations

**Quick Summary:**
1. Create project at [supabase.com](https://supabase.com)
2. Get pooled connection string from Settings → Database → Connection Pooling
3. Save it for Step 4

## Step 2: Prepare Your Repository

Ensure your code is pushed to Git:

```bash
# Commit all changes
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

## Step 3: Create Vercel Project

### Option A: Via Vercel Dashboard (Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "Add New Project"**
3. **Import your Git repository**:
   - Select your Git provider (GitHub/GitLab/Bitbucket)
   - Choose the `cryptoart-monorepo` repository
   - Click "Import"

4. **Configure Project Settings**:
   - **Project Name**: `cryptoart-studio-app` (or your preferred name)
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/cryptoart-studio-app`
   - **Build Command**: `cd ../.. && turbo build --filter=cryptoart-studio-app`
   - **Output Directory**: `.next` (default)
   - **Install Command**: `pnpm install` (or leave blank, Vercel auto-detects)

5. **Important Turborepo Settings**:
   - Ensure **Root Directory** is set to `apps/cryptoart-studio-app`
   - The build command will run from the monorepo root automatically
   - Vercel will detect pnpm from `packageManager` field in root `package.json`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# From project root
cd /path/to/cryptoart-monorepo

# Link project
vercel link

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name: cryptoart-studio-app
# - Directory: ./apps/cryptoart-studio-app
# - Override settings? Yes
#   - Build Command: cd ../.. && turbo build --filter=cryptoart-studio-app
#   - Output Directory: .next
#   - Install Command: pnpm install

# Deploy
vercel --prod
```

## Step 4: Configure Environment Variables

### Required Variables

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables** and add:

#### 1. PostgreSQL Connection
```
Key: POSTGRES_URL
Value: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
Environment: Production, Preview, Development
```

**Get this from**: Supabase Dashboard → Settings → Database → Connection Pooling

#### 2. Public URL
```
Key: NEXT_PUBLIC_URL
Value: https://your-project.vercel.app
Environment: Production
```

**Note**: For Preview environments, use `$VERCEL_URL` (auto-set by Vercel)

#### 3. Neynar API (if using Farcaster features)
```
Key: NEYNAR_API_KEY
Value: your-neynar-api-key
Environment: Production, Preview
```

```
Key: NEYNAR_CLIENT_ID
Value: your-neynar-client-id
Environment: Production, Preview
```

### Optional Variables

See [VERCEL_ENV_VARS.md](../apps/cryptoart-studio-app/VERCEL_ENV_VARS.md) for complete list.

**Quick additions:**
- `KV_REST_API_URL` (if using Upstash Redis)
- `KV_REST_API_TOKEN` (if using Upstash Redis)
- `CRON_SECRET` (for scheduled jobs)
- `ALCHEMY_API_KEY` (for blockchain queries)

## Step 5: Run Database Migrations

Before deploying, set up your database schema:

1. **Clone repository locally** (if not already):
   ```bash
   git clone https://github.com/your-username/cryptoart-monorepo.git
   cd cryptoart-monorepo
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Create `.env.local`** in project root:
   ```bash
   POSTGRES_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

4. **Run migrations**:
   ```bash
   pnpm db:push
   ```

5. **Verify tables were created**:
   - Go to Supabase Dashboard → Table Editor
   - You should see all required tables

## Step 6: Deploy to Vercel

### First Deployment

1. **Trigger deployment**:
   - If using Git integration: Push to your main branch
   - If using CLI: Run `vercel --prod`
   - Or click "Deploy" in Vercel Dashboard

2. **Monitor build**:
   - Go to Vercel Dashboard → Deployments
   - Watch the build logs
   - Build should complete in 3-5 minutes

3. **Check for errors**:
   - Look for any build errors in logs
   - Common issues:
     - Missing environment variables
     - Build command issues
     - Dependency resolution problems

### Verify Deployment

1. **Visit your deployment URL**:
   - Format: `https://your-project.vercel.app`
   - Check that the app loads correctly

2. **Test API routes**:
   ```bash
   curl https://your-project.vercel.app/api/health
   ```

3. **Check logs**:
   - Vercel Dashboard → Your Project → Logs
   - Look for any runtime errors

## Step 7: Configure Custom Domain (Optional)

1. **Go to Vercel Dashboard** → **Your Project** → **Settings** → **Domains**
2. **Add your domain**:
   - Enter your domain (e.g., `cryptoart.social`)
   - Follow DNS configuration instructions
3. **Update environment variable**:
   - Update `NEXT_PUBLIC_URL` to your custom domain
   - Redeploy

## Step 8: Verify Cron Jobs

Cron jobs are automatically configured via `vercel.json`:

1. **Check cron configuration**:
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for scheduled functions

2. **Verify cron jobs are running**:
   - Check Vercel logs for cron job executions
   - Cron jobs run at:
     - `/api/sync/subscriptions` - Every hour (`0 * * * *`)
     - `/api/sync/subscribers` - Every 15 minutes (`*/15 * * * *`)

## Troubleshooting

### Build Fails: "Cannot find module"

**Problem**: Workspace packages not found during build

**Solution**:
- Ensure `Root Directory` is set to `apps/cryptoart-studio-app`
- Verify build command includes `turbo build --filter=cryptoart-studio-app`
- Check that workspace dependencies are listed in `package.json`

### Build Fails: "POSTGRES_URL is required"

**Problem**: Database connection string not set

**Solution**:
- Verify `POSTGRES_URL` is added in Vercel Dashboard
- Ensure it's set for the correct environment (Production/Preview)
- Check connection string format matches Supabase pooled connection

### Deployment Works But Database Errors

**Problem**: Can't connect to database

**Solution**:
- Verify `POSTGRES_URL` uses pooled connection (port 6543)
- Check Supabase Dashboard → Settings → Database → Connection Pooling
- Ensure `pgbouncer=true` parameter is in connection string
- Check Supabase database is running

### Environment Variables Not Updating

**Problem**: Changes to env vars don't take effect

**Solution**:
- Environment variables only apply to **new deployments**
- After adding/changing variables, trigger a new deployment
- Or manually redeploy from Vercel Dashboard

### Turborepo Build Issues

**Problem**: Dependencies not building correctly

**Solution**:
- Verify `turbo.json` is in project root
- Check build command: `cd ../.. && turbo build --filter=cryptoart-studio-app`
- Ensure all workspace dependencies are properly configured
- Check that `@cryptoart/shared-db-config` and `@cryptoart/db` are in dependencies

## Continuous Deployment

Once configured, Vercel will automatically deploy:

- **Production**: On push to `main` branch
- **Preview**: On every pull request
- **Development**: When running `vercel dev`

## Monitoring

### Vercel Analytics

Enable Vercel Analytics in Dashboard → Settings → Analytics

### Logs

View logs in:
- **Real-time**: Vercel Dashboard → Your Project → Logs
- **Function logs**: Vercel Dashboard → Your Project → Functions

### Database Monitoring

Monitor Supabase:
- Supabase Dashboard → Database → Usage
- Check connection pool usage
- Monitor query performance

## Next Steps

After successful deployment:

1. ✅ Test all features in production
2. ✅ Set up monitoring and alerts
3. ✅ Configure backup strategy for database
4. ✅ Set up staging environment (Preview deployments)
5. ✅ Document any custom configurations

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

For environment variable reference, see:
- [VERCEL_ENV_VARS.md](../apps/cryptoart-studio-app/VERCEL_ENV_VARS.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

