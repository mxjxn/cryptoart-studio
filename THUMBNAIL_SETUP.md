# Thumbnail Setup Guide

## 1. Database Table Setup

Yes, you need to create the `thumbnail_cache` table. Use the dedicated script:

### Quick Setup (Recommended)

```bash
cd packages/db
pnpm db:create-thumbnail-cache
```

This will create just the `thumbnail_cache` table and indexes. It's idempotent - safe to run multiple times.

### Alternative: Use Drizzle Push

If you prefer to sync the schema directly:

```bash
cd packages/db
pnpm db:push
```

### Verify Table Was Created

```bash
cd packages/db
pnpm db:status
# Should show thumbnail_cache in the list

# Or verify all tables
pnpm db:verify
```

## 2. Vercel Blob Setup

### Step 1: Install the Package

```bash
cd apps/mvp
npm install @vercel/blob
```

### Step 2: Get Your Vercel Blob Token

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Storage**
3. Click **Create Database** → **Blob**
4. Once created, you'll see:
   - **BLOB_READ_WRITE_TOKEN** - Copy this token
   - **BLOB_READ_URL** - This is your blob storage URL (e.g., `https://[project].public.blob.vercel-storage.com`)

### Step 3: Add Environment Variables

Add these to your `.env.local` file (or Vercel environment variables):

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxx
BLOB_READ_URL=https://your-project.public.blob.vercel-storage.com
```

**Note:** `BLOB_STORE_ID` is not needed - the code only uses `BLOB_READ_WRITE_TOKEN` and `BLOB_READ_URL`.

### Step 4: Deploy or Test Locally

The thumbnail system will automatically use Vercel Blob when these environment variables are set.

## Preferred on VPS: Cloudflare R2

Vercel Blob is legacy. On Hostinger, configure R2 (no egress fees). Shared helper: `apps/mvp/src/lib/server/object-storage.ts` (thumbnails + IPFS cache).

```bash
# .env.production / .env.local
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
# Public CDN / r2.dev URL used in <img src> — not the API endpoint
R2_PUBLIC_URL=https://media.cryptoart.social
```

`S3_*` aliases still work. If `R2_BUCKET` is set, R2 wins over `BLOB_READ_WRITE_TOKEN`.

## Testing

Once set up, test the thumbnail endpoint:

```bash
# Test thumbnail generation
curl "http://localhost:3000/api/thumbnails?imageUrl=https://example.com/image.jpg&size=medium"
```

You should get a response like:
```json
{
  "thumbnailUrl": "https://your-blob-url.vercel-storage.com/thumbnails/abc123.webp",
  "cached": false
}
```

## Troubleshooting

### "No storage backend configured"
- Make sure you've set either `BLOB_READ_WRITE_TOKEN` or `R2_BUCKET` in your environment variables

### "@vercel/blob is required"
- Run: `npm install @vercel/blob` in `apps/mvp`

### "thumbnailCache table not found"
- Run the database migration: `cd packages/db && pnpm db:push`

