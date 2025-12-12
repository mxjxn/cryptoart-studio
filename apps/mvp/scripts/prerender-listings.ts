#!/usr/bin/env tsx

/**
 * Batch script to pre-render OG images and listing cards for existing listings
 * 
 * Usage:
 *   pnpm tsx scripts/prerender-listings.ts [options]
 * 
 * Options:
 *   --limit N        Pre-render only the first N listings (default: all)
 *   --skip N         Skip the first N listings
 *   --concurrency N  Number of concurrent pre-renders (default: 3)
 *   --og-only        Only pre-render OG images
 *   --cards-only     Only pre-render listing cards
 */

import { getAuctionServer } from '../src/lib/server/auction';
import { prerenderListingOGImage, prerenderListingOGImagesBatch } from '../src/lib/server/og-image-prerender';
import { prerenderListingCardDataBatch } from '../src/lib/server/listing-card-prerender';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

async function getActiveListingIds(limit?: number, skip: number = 0): Promise<string[]> {
  // This is a simplified version - in production, you might want to query the subgraph
  // or database directly to get listing IDs
  console.log('[Prerender Script] Fetching active listing IDs...');
  
  // For now, we'll need to get listing IDs from somewhere
  // This is a placeholder - you'll need to implement based on your data source
  const listingIds: string[] = [];
  
  // Example: If you have a way to get recent listings
  // const response = await fetch(`${APP_URL}/api/listings/browse?first=${limit || 1000}&skip=${skip}`);
  // const data = await response.json();
  // return data.listings.map((l: any) => l.listingId);
  
  console.warn('[Prerender Script] getActiveListingIds not fully implemented - you may need to provide listing IDs manually');
  return listingIds;
}

async function main() {
  const args = process.argv.slice(2);
  
  let limit: number | undefined;
  let skip = 0;
  let concurrency = 3;
  let ogOnly = false;
  let cardsOnly = false;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--skip' && args[i + 1]) {
      skip = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--og-only') {
      ogOnly = true;
    } else if (arg === '--cards-only') {
      cardsOnly = true;
    }
  }
  
  console.log('[Prerender Script] Starting batch pre-render...');
  console.log(`[Prerender Script] Options: limit=${limit || 'all'}, skip=${skip}, concurrency=${concurrency}`);
  
  // Get listing IDs
  // For now, you can provide listing IDs manually or implement getActiveListingIds
  const listingIds = await getActiveListingIds(limit, skip);
  
  if (listingIds.length === 0) {
    console.log('[Prerender Script] No listing IDs found. Exiting.');
    return;
  }
  
  console.log(`[Prerender Script] Found ${listingIds.length} listings to pre-render`);
  
  // Pre-render OG images
  if (!cardsOnly) {
    console.log('[Prerender Script] Pre-rendering OG images...');
    await prerenderListingOGImagesBatch(listingIds, APP_URL, concurrency);
  }
  
  // Pre-render listing cards
  if (!ogOnly) {
    console.log('[Prerender Script] Pre-rendering listing cards...');
    await prerenderListingCardDataBatch(listingIds, concurrency);
  }
  
  console.log('[Prerender Script] Batch pre-render completed!');
}

main().catch((error) => {
  console.error('[Prerender Script] Fatal error:', error);
  process.exit(1);
});
