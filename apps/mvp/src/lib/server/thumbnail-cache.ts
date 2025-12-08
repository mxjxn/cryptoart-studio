import { getDatabase } from '@cryptoart/db';
import { eq, and, gt } from 'drizzle-orm';

// Thumbnail cache table - optional, may not exist in schema
// We'll try to import it lazily when needed
async function getThumbnailCache(): Promise<any | null> {
  try {
    const dbModule = await import('@cryptoart/db') as any;
    return dbModule.thumbnailCache || null;
  } catch {
    return null;
  }
}

/**
 * Thumbnail size presets
 */
export type ThumbnailSize = 'small' | 'medium' | 'large' | string;

export interface ThumbnailDimensions {
  width: number;
  height: number;
}

/**
 * Size presets for common use cases
 */
const SIZE_PRESETS: Record<string, ThumbnailDimensions> = {
  small: { width: 200, height: 200 },   // For list views, cards
  medium: { width: 500, height: 500 },  // For detail previews
  large: { width: 1000, height: 1000 }, // For full detail views
  embed: { width: 1180, height: 610 },   // For embeds: fits within 1200x630 with 10px margin
};

/**
 * Normalize image URL for caching (extract IPFS hash if present)
 * This ensures the same image is cached regardless of gateway used
 */
function normalizeImageUrl(url: string): string {
  // Extract IPFS hash if present
  if (url.includes('/ipfs/')) {
    const hash = url.split('/ipfs/')[1]?.split('/')[0];
    if (hash) {
      return `ipfs://${hash}`;
    }
  }
  if (url.startsWith('ipfs://')) {
    return url;
  }
  // For non-IPFS URLs, use as-is
  return url;
}

/**
 * Get dimensions for a thumbnail size
 */
export function getThumbnailDimensions(size: ThumbnailSize): ThumbnailDimensions {
  if (SIZE_PRESETS[size]) {
    return SIZE_PRESETS[size];
  }
  // Parse custom size like "300x400"
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }
  // Default to medium
  return SIZE_PRESETS.medium;
}

/**
 * Get cached thumbnail URL if available and not expired
 */
export async function getCachedThumbnail(
  imageUrl: string,
  size: ThumbnailSize = 'medium'
): Promise<string | null> {
  try {
    // Try to get thumbnailCache table - it may not exist
    const thumbnailCache = await getThumbnailCache();
    if (!thumbnailCache) {
      return null;
    }

    const db = getDatabase();
    if (!db) {
      return null;
    }

    const normalizedUrl = normalizeImageUrl(imageUrl);
    const now = new Date();

    const cached = await db
      .select()
      .from(thumbnailCache)
      .where(
        and(
          eq(thumbnailCache.imageUrl, normalizedUrl),
          eq(thumbnailCache.size, size),
          gt(thumbnailCache.expiresAt, now)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      console.log(`[Thumbnail Cache] Cache hit for ${normalizedUrl} (${size})`);
      return cached[0].thumbnailUrl;
    }

    console.log(`[Thumbnail Cache] Cache miss for ${normalizedUrl} (${size})`);
    return null;
  } catch (error) {
    console.warn(`[Thumbnail Cache] Error reading cache:`, error);
    return null;
  }
}

/**
 * Cache thumbnail URL with 30-day expiration
 */
export async function cacheThumbnail(
  imageUrl: string,
  size: ThumbnailSize,
  thumbnailUrl: string,
  dimensions: ThumbnailDimensions,
  contentType: string,
  fileSize?: number
): Promise<void> {
  try {
    // Try to get thumbnailCache table - it may not exist
    const thumbnailCache = await getThumbnailCache();
    if (!thumbnailCache) {
      return;
    }

    const db = getDatabase();
    if (!db) {
      return;
    }

    const normalizedUrl = normalizeImageUrl(imageUrl);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db
      .insert(thumbnailCache)
      .values({
        imageUrl: normalizedUrl,
        size,
        thumbnailUrl,
        width: dimensions.width,
        height: dimensions.height,
        fileSize: fileSize || null,
        contentType,
        cachedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [thumbnailCache.imageUrl, thumbnailCache.size],
        set: {
          thumbnailUrl,
          width: dimensions.width,
          height: dimensions.height,
          fileSize: fileSize || null,
          contentType,
          cachedAt: now,
          expiresAt,
        },
      });

    console.log(`[Thumbnail Cache] Cached thumbnail ${normalizedUrl} (${size}), expires at ${expiresAt.toISOString()}`);
  } catch (error) {
    console.warn(`[Thumbnail Cache] Error caching thumbnail:`, error);
    // Don't throw - caching is optional
  }
}

