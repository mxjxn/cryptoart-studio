import { getDatabase, imageCache } from '@cryptoart/db';
import { eq, and, gt } from 'drizzle-orm';

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
 * Get cached image data URL if available and not expired
 */
export async function getCachedImage(imageUrl: string): Promise<string | null> {
  try {
    const db = getDatabase();
    if (!db) {
      return null;
    }

    const normalizedUrl = normalizeImageUrl(imageUrl);
    const now = new Date();

    const cached = await db
      .select()
      .from(imageCache)
      .where(
        and(
          eq(imageCache.imageUrl, normalizedUrl),
          gt(imageCache.expiresAt, now)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      console.log(`[Image Cache] Cache hit for ${normalizedUrl}`);
      return cached[0].dataUrl;
    }

    console.log(`[Image Cache] Cache miss for ${normalizedUrl}`);
    return null;
  } catch (error) {
    console.warn(`[Image Cache] Error reading cache:`, error);
    return null;
  }
}

/**
 * Cache image data URL with 3-day expiration
 */
export async function cacheImage(
  imageUrl: string,
  dataUrl: string,
  contentType: string
): Promise<void> {
  try {
    const db = getDatabase();
    if (!db) {
      return;
    }

    const normalizedUrl = normalizeImageUrl(imageUrl);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

    await db
      .insert(imageCache)
      .values({
        imageUrl: normalizedUrl,
        dataUrl,
        contentType,
        cachedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: imageCache.imageUrl,
        set: {
          dataUrl,
          contentType,
          cachedAt: now,
          expiresAt,
        },
      });

    console.log(`[Image Cache] Cached image ${normalizedUrl}, expires at ${expiresAt.toISOString()}`);
  } catch (error) {
    console.warn(`[Image Cache] Error caching image:`, error);
    // Don't throw - caching is optional
  }
}

