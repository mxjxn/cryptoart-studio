# Thumbnail Caching System

## Overview

This system caches small, web-optimized versions of NFT images to avoid loading massive full-scale artwork repeatedly. It's designed to be safe, affordable, and scalable for 500+ users/month.

## How It Works

1. **When an NFT is listed**: The system checks if a thumbnail exists for the image
2. **If not cached**: It fetches the original image, resizes it, optimizes it (WebP format), and stores it
3. **Storage**: Thumbnails are stored in object storage (not in the database) and URLs are cached in the database
4. **Serving**: Thumbnails are served via CDN or direct storage URLs

## Architecture

### Database Table: `thumbnail_cache`

Stores metadata about cached thumbnails:
- `image_url`: Original image URL (normalized)
- `size`: Thumbnail size ('small', 'medium', 'large', or custom 'WxH')
- `thumbnail_url`: URL to the cached thumbnail (points to object storage)
- `width`, `height`: Dimensions
- `file_size`: Size in bytes
- `content_type`: MIME type (usually 'image/webp')
- `cached_at`, `expires_at`: Cache timestamps

### Storage Backends

The system supports multiple storage backends:

1. **Cloudflare R2** (Recommended for cost-effectiveness)
   - S3-compatible API
   - **No egress fees** (unlike AWS S3)
   - $0.015/GB/month storage
   - Perfect for 500 users/month

2. **Vercel Blob Storage** (If deploying on Vercel)
   - Integrated with Vercel
   - $0.15/GB/month storage
   - $0.40/GB egress

3. **AWS S3** (Traditional option)
   - $0.023/GB/month storage
   - $0.09/GB egress

4. **Local Filesystem** (Development only)
   - Stores in `/tmp/thumbnails`
   - Not suitable for production

## Cost Analysis (500 users/month)

### Assumptions
- Average 10 listings per user = 5,000 listings/month
- Average thumbnail size: 50KB (WebP optimized)
- Total storage: ~250MB (5,000 × 50KB)
- Cache hit rate: 80% (most thumbnails reused)

### Cloudflare R2 (Recommended)
- **Storage**: 250MB × $0.015/GB = **$0.004/month**
- **Egress**: **$0** (no egress fees!)
- **Processing**: Minimal (only on cache miss)
- **Total**: **~$0.01/month** 🎉

### Vercel Blob Storage
- **Storage**: 250MB × $0.15/GB = **$0.038/month**
- **Egress**: 250MB × 20% miss rate × $0.40/GB = **$0.02/month**
- **Total**: **~$0.06/month**

### AWS S3
- **Storage**: 250MB × $0.023/GB = **$0.006/month**
- **Egress**: 250MB × 20% miss rate × $0.09/GB = **$0.005/month**
- **Total**: **~$0.01/month**

**Conclusion**: For 500 users/month, costs are negligible (< $0.10/month). Cloudflare R2 is the best choice due to zero egress fees.

## Setup

### 1. Install Dependencies

```bash
cd apps/mvp
npm install sharp @aws-sdk/client-s3
# OR for Vercel Blob:
npm install @vercel/blob
```

### 2. Run Database Migration

```bash
cd packages/db
pnpm run db:push
# OR manually run:
# psql $POSTGRES_URL < migrations/0002_add_thumbnail_cache.sql
```

### 3. Configure Storage Backend

Choose one:

#### Option A: Cloudflare R2 (Recommended)

```bash
# .env.local
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_REGION=auto
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

#### Option B: Vercel Blob Storage

```bash
# .env.local
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
BLOB_READ_URL=https://your-blob-url.vercel-storage.com
```

#### Option C: AWS S3

```bash
# .env.local
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

## Usage

### In Server Components

```tsx
import { getThumbnailUrlSync } from '~/lib/thumbnail-utils';

export default async function NFTListing({ imageUrl }: { imageUrl: string }) {
  const thumbnailUrl = await getThumbnailUrlSync(imageUrl, 'medium');
  
  return <img src={thumbnailUrl} alt="NFT" />;
}
```

### In Client Components

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';

export function NFTImage({ imageUrl }: { imageUrl: string }) {
  const { data: thumbnailUrl } = useQuery({
    queryKey: ['thumbnail', imageUrl, 'medium'],
    queryFn: async () => {
      const res = await fetch(`/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=medium`);
      const data = await res.json();
      return data.thumbnailUrl;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
  
  return <img src={thumbnailUrl || imageUrl} alt="NFT" />;
}
```

### Direct API Call

```typescript
// GET /api/thumbnails?imageUrl=https://...&size=medium
// Returns: { thumbnailUrl: "...", cached: true/false }
```

## Thumbnail Sizes

- **small**: 200×200px - For list views, cards
- **medium**: 500×500px - For detail previews (default)
- **large**: 1000×1000px - For full detail views
- **custom**: `300x400` - Custom dimensions

## Security Considerations

1. **Input Validation**: Image URLs are validated before processing
2. **Timeout**: 30-second timeout on image fetches
3. **Size Limits**: Images are resized to reasonable dimensions
4. **Storage Access**: Storage credentials are kept secure in environment variables
5. **Cache Expiration**: Thumbnails expire after 30 days

## Performance

- **Cache Hit**: < 10ms (database lookup)
- **Cache Miss**: 2-5 seconds (fetch + resize + upload)
- **Storage**: Thumbnails are served via CDN for fast delivery
- **Bandwidth Savings**: ~95% reduction (50KB thumbnail vs 1MB+ original)

## Monitoring

Check cache performance:
```sql
SELECT 
  size,
  COUNT(*) as count,
  AVG(file_size) as avg_size_bytes,
  SUM(file_size) as total_size_bytes
FROM thumbnail_cache
WHERE expires_at > NOW()
GROUP BY size;
```

## Troubleshooting

### "sharp library is required"
```bash
npm install sharp
```

### "No storage backend configured"
Set one of: `R2_BUCKET`, `S3_BUCKET`, or `BLOB_READ_WRITE_TOKEN`

### Thumbnails not generating
- Check storage credentials
- Verify image URLs are accessible
- Check server logs for errors

### High costs
- Review cache hit rate (should be > 80%)
- Consider reducing thumbnail sizes
- Check for storage leaks (expired entries not cleaned up)






