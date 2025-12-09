/**
 * Background thumbnail generation
 * 
 * This module handles generating thumbnails for listings in the background,
 * so they're ready before users view them. This prevents slow page loads.
 */

import { getOrGenerateThumbnail } from './thumbnail-generator';
import { getCachedThumbnail, cacheThumbnail } from './thumbnail-cache';
import { getDatabase } from '@cryptoart/db';

/**
 * Generate thumbnails for a listing's image in the background
 * This should be called when a listing is created, not when users view it
 * 
 * @param imageUrl - The original image URL
 * @param listingId - The listing ID (for logging/tracking)
 * @param sizes - Array of thumbnail sizes to generate (default: ['small', 'medium'])
 */
export async function generateThumbnailsBackground(
  imageUrl: string,
  listingId?: string,
  sizes: string[] = ['small', 'medium']
): Promise<void> {
  if (!imageUrl) {
    return;
  }

  // Run thumbnail generation in background (don't await)
  // This prevents blocking the main process
  Promise.all(
    sizes.map(async (size) => {
      try {
        // Check if already cached
        const cached = await getCachedThumbnail(imageUrl, size);
        if (cached) {
          console.log(`[Background Thumbnails] Already cached: ${imageUrl} (${size})`);
          return;
        }

        // Generate thumbnail
        console.log(`[Background Thumbnails] Generating thumbnail for listing ${listingId || 'unknown'}: ${imageUrl} (${size})`);
        const thumbnailUrl = await getOrGenerateThumbnail(imageUrl, size);
        console.log(`[Background Thumbnails] Generated thumbnail for listing ${listingId || 'unknown'}: ${thumbnailUrl} (${size})`);
      } catch (error) {
        // Log error but don't throw - we don't want to break the listing creation flow
        console.error(`[Background Thumbnails] Failed to generate thumbnail for listing ${listingId || 'unknown'}: ${imageUrl} (${size}):`, error);
      }
    })
  ).catch((error) => {
    // Catch any unhandled errors
    console.error(`[Background Thumbnails] Error in background thumbnail generation for listing ${listingId || 'unknown'}:`, error);
  });
}

/**
 * Generate thumbnails for multiple listings in batch
 * Useful for processing new listings from the subgraph
 * 
 * @param listings - Array of listings with image URLs
 */
export async function generateThumbnailsForListings(
  listings: Array<{ listingId: string; imageUrl?: string }>
): Promise<void> {
  const jobs = listings
    .filter((listing) => listing.imageUrl)
    .map((listing) =>
      generateThumbnailsBackground(listing.imageUrl!, listing.listingId, ['small', 'medium'])
    );

  // Run all jobs in parallel, but don't await (fire and forget)
  Promise.all(jobs).catch((error) => {
    console.error('[Background Thumbnails] Error in batch thumbnail generation:', error);
  });
}

/**
 * Get thumbnail status for an image URL
 * Returns 'ready', 'generating', or 'error'
 */
export async function getThumbnailStatus(
  imageUrl: string,
  size: string = 'small'
): Promise<'ready' | 'generating' | 'error' | null> {
  try {
    const db = getDatabase();
    if (!db) {
      return null;
    }

    // Try to get thumbnailCache table dynamically
    const dbModule = await import('@cryptoart/db') as any;
    const thumbnailCache = dbModule.thumbnailCache;
    if (!thumbnailCache) {
      return null;
    }

    const { eq, and } = await import('@cryptoart/db');
    
    // Normalize image URL (extract IPFS hash if present)
    let normalizedUrl = imageUrl;
    if (imageUrl.includes('/ipfs/')) {
      const hash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
      if (hash) {
        normalizedUrl = `ipfs://${hash}`;
      }
    } else if (imageUrl.startsWith('ipfs://')) {
      normalizedUrl = imageUrl;
    }

    const cached = await db
      .select()
      .from(thumbnailCache)
      .where(
        and(
          eq(thumbnailCache.imageUrl, normalizedUrl),
          eq(thumbnailCache.size, size)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      return (cached[0].status as 'ready' | 'generating' | 'error') || 'ready';
    }

    return null;
  } catch (error) {
    console.warn(`[Background Thumbnails] Error checking thumbnail status:`, error);
    return null;
  }
}

