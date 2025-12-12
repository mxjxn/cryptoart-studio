/**
 * Pre-render OG images for listings
 * This generates and caches OG images when listings are created/updated
 * Since listing metadata never changes, we can pre-render these ahead of time
 */

import { getAuctionServer } from './auction';

/**
 * Pre-render OG image for a listing
 * This triggers the OG image generation endpoint which will cache the result
 * 
 * @param listingId - The listing ID to pre-render
 * @param baseUrl - Base URL of the application (for generating the OG image URL)
 * @returns Promise that resolves when pre-rendering is complete (or fails silently)
 */
export async function prerenderListingOGImage(
  listingId: string,
  baseUrl?: string
): Promise<void> {
  try {
    // Get the base URL from environment or parameter
    const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    
    // Construct the OG image URL
    const ogImageUrl = `${url}/listing/${listingId}/opengraph-image`;
    
    console.log(`[OG Image Prerender] Pre-rendering OG image for listing ${listingId}...`);
    
    // Fetch the OG image endpoint to trigger generation and caching
    // Use a longer timeout since we're processing media
    const response = await fetch(ogImageUrl, {
      headers: {
        'User-Agent': 'CryptoArt-Prerender/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!response.ok) {
      console.warn(
        `[OG Image Prerender] Failed to pre-render OG image for listing ${listingId}: ${response.status} ${response.statusText}`
      );
      return;
    }
    
    // Read the response to ensure it's fully generated (even though we don't use it)
    await response.arrayBuffer();
    
    console.log(`[OG Image Prerender] Successfully pre-rendered OG image for listing ${listingId}`);
  } catch (error) {
    // Don't throw - pre-rendering is optional and shouldn't block listing creation
    console.warn(
      `[OG Image Prerender] Error pre-rendering OG image for listing ${listingId}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Pre-render OG images for multiple listings in batch
 * Processes them sequentially to avoid overwhelming the server
 * 
 * @param listingIds - Array of listing IDs to pre-render
 * @param baseUrl - Base URL of the application
 * @param concurrency - Number of concurrent pre-renders (default: 3)
 */
export async function prerenderListingOGImagesBatch(
  listingIds: string[],
  baseUrl?: string,
  concurrency: number = 3
): Promise<void> {
  console.log(`[OG Image Prerender] Starting batch pre-render for ${listingIds.length} listings...`);
  
  // Process in batches to avoid overwhelming the server
  for (let i = 0; i < listingIds.length; i += concurrency) {
    const batch = listingIds.slice(i, i + concurrency);
    await Promise.all(
      batch.map(listingId => prerenderListingOGImage(listingId, baseUrl))
    );
    
    // Small delay between batches to avoid rate limiting
    if (i + concurrency < listingIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[OG Image Prerender] Completed batch pre-render for ${listingIds.length} listings`);
}

/**
 * Pre-render OG image for a listing if it doesn't exist
 * Checks if the listing exists and has an image before pre-rendering
 * 
 * @param listingId - The listing ID to pre-render
 * @param baseUrl - Base URL of the application
 */
export async function prerenderListingOGImageIfNeeded(
  listingId: string,
  baseUrl?: string
): Promise<void> {
  try {
    // Check if listing exists and has an image
    const listing = await getAuctionServer(listingId);
    if (!listing) {
      console.log(`[OG Image Prerender] Listing ${listingId} not found, skipping pre-render`);
      return;
    }
    
    const imageUrl = listing.image || listing.metadata?.image || listing.thumbnailUrl;
    if (!imageUrl) {
      console.log(`[OG Image Prerender] Listing ${listingId} has no image, skipping pre-render`);
      return;
    }
    
    // Pre-render the OG image
    await prerenderListingOGImage(listingId, baseUrl);
  } catch (error) {
    console.warn(
      `[OG Image Prerender] Error checking listing ${listingId} for pre-render:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}
