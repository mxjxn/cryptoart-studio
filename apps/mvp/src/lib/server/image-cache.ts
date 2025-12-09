import { getDatabase, imageCache, eq, and, gt } from '@cryptoart/db';

/**
 * Normalize image URL for caching (extract IPFS hash if present)
 * This ensures the same image is cached regardless of gateway used
 */
function normalizeImageUrl(url: string): string {
  if (!url) return url;
  
  // Handle IPFS protocol URLs
  if (url.startsWith('ipfs://')) {
    // Remove any query params or fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    return cleanUrl;
  }
  
  // Extract IPFS hash from gateway URLs (e.g., https://ipfs.io/ipfs/QmHash, https://cloudflare-ipfs.com/ipfs/QmHash)
  if (url.includes('/ipfs/')) {
    // Extract hash from URL like https://gateway.com/ipfs/QmHash?params or https://gateway.com/ipfs/QmHash#fragment
    const match = url.match(/\/ipfs\/([^\/?#]+)/);
    if (match && match[1]) {
      return `ipfs://${match[1]}`;
    }
  }
  
  // For non-IPFS URLs (HTTP/HTTPS that aren't IPFS gateways), use as-is
  // This includes data URIs, Arweave URLs, and regular HTTP URLs
  return url;
}

/**
 * Get cached image data URL if available and not expired
 */
export async function getCachedImage(imageUrl: string): Promise<string | null> {
  try {
    const db = getDatabase();
    if (!db) {
      console.log(`[Image Cache] No database connection, skipping cache lookup for ${imageUrl}`);
      return null;
    }

    const normalizedUrl = normalizeImageUrl(imageUrl);
    console.log(`[Image Cache] Looking up cache: original="${imageUrl}" normalized="${normalizedUrl}"`);
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
      console.log(`[Image Cache] Cache hit for ${normalizedUrl} (expires: ${cached[0].expiresAt.toISOString()})`);
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


