#!/usr/bin/env tsx
/**
 * Cleanup Cancelled Listings Images Script
 * 
 * Finds cancelled listings and removes their cached thumbnails/images.
 * This helps free up storage space and ensures cancelled listings don't
 * have cached images displayed.
 * 
 * Usage:
 *   pnpm tsx scripts/cleanup-cancelled-listings-images.ts
 *   pnpm tsx scripts/cleanup-cancelled-listings-images.ts --dry-run
 *   pnpm tsx scripts/cleanup-cancelled-listings-images.ts --limit 100
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from the apps/mvp directory
config({ path: resolve(__dirname, '../.env.local') });

// Also try .env in the same directory
config({ path: resolve(__dirname, '../.env') });

// Also try .env.local from project root
const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env.local') });
config({ path: resolve(projectRoot, '.env') });

import { request, gql } from "graphql-request";
import type { Address } from "viem";

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY || process.env.NEXT_PUBLIC_GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

// Use dynamic imports to work with Next.js path aliases
async function getImports() {
  const [
    { fetchNFTMetadata },
    { getDatabase },
  ] = await Promise.all([
    import("../src/lib/nft-metadata"),
    import("@cryptoart/db"),
  ]);
  
  return {
    fetchNFTMetadata,
    getDatabase,
  };
}

interface Listing {
  id: string;
  listingId: string;
  tokenAddress: string;
  tokenId: string;
  tokenSpec: number;
  status: string;
  finalized: boolean;
  totalSold: string;
  totalAvailable: string;
  createdAt: string;
}

const CANCELLED_LISTINGS_QUERY = gql`
  query CancelledListings($first: Int!, $skip: Int!) {
    listings(
      where: { status: "CANCELLED" }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      listingId
      tokenAddress
      tokenId
      tokenSpec
      status
      finalized
      totalSold
      totalAvailable
      createdAt
    }
  }
`;

async function fetchCancelledListings(
  endpoint: string,
  headers: Record<string, string>,
  limit: number = 1000,
  skip: number = 0
): Promise<Listing[]> {
  const data = await request<{ listings: Listing[] }>(
    endpoint,
    CANCELLED_LISTINGS_QUERY,
    {
      first: Math.min(limit, 1000),
      skip,
    },
    headers
  );
  
  return data.listings || [];
}

async function normalizeImageUrl(url: string): Promise<string> {
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

async function getThumbnailCacheTable(db: any): Promise<any | null> {
  try {
    const dbModule = await import('@cryptoart/db') as any;
    return dbModule.thumbnailCache || null;
  } catch {
    return null;
  }
}

async function deleteThumbnailsForImage(
  db: any,
  thumbnailCache: any,
  imageUrl: string,
  dryRun: boolean
): Promise<number> {
  const normalizedUrl = await normalizeImageUrl(imageUrl);
  
  if (dryRun) {
    // Just count what would be deleted
    const { eq } = await import('@cryptoart/db');
    const entries = await db
      .select()
      .from(thumbnailCache)
      .where(eq(thumbnailCache.imageUrl, normalizedUrl));
    return entries.length;
  }
  
  // Actually delete
  const { eq } = await import('@cryptoart/db');
  const deleted = await db
    .delete(thumbnailCache)
    .where(eq(thumbnailCache.imageUrl, normalizedUrl))
    .returning({ imageUrl: thumbnailCache.imageUrl, size: thumbnailCache.size });
  
  return deleted.length;
}

async function cleanupCancelledListingsImages(options: {
  limit?: number;
  dryRun?: boolean;
  batchSize?: number;
} = {}) {
  const {
    limit = 1000,
    dryRun = false,
    batchSize = 10,
  } = options;

  console.log(`[Cleanup Cancelled Listings] Starting cleanup...`);
  console.log(`[Cleanup Cancelled Listings] Options:`, { limit, dryRun, batchSize });

  const imports = await getImports();
  const endpoint = getSubgraphEndpoint();
  const headers = getSubgraphHeaders();
  const db = imports.getDatabase();

  // Get thumbnail cache table
  const thumbnailCache = await getThumbnailCacheTable(db);
  if (!thumbnailCache) {
    console.error('[Cleanup Cancelled Listings] thumbnail_cache table not found. Skipping thumbnail cleanup.');
  }

  // Fetch cancelled listings
  console.log(`[Cleanup Cancelled Listings] Fetching cancelled listings...`);
  const cancelledListings = await fetchCancelledListings(endpoint, headers, limit, 0);
  console.log(`[Cleanup Cancelled Listings] Found ${cancelledListings.length} cancelled listings`);

  if (cancelledListings.length === 0) {
    console.log(`[Cleanup Cancelled Listings] No cancelled listings found. Exiting.`);
    return;
  }

  let processed = 0;
  let thumbnailsDeleted = 0;
  let thumbnailsFound = 0;
  let failed = 0;
  const imageUrls = new Set<string>();

  // Process listings in batches
  for (let i = 0; i < cancelledListings.length; i += batchSize) {
    const batch = cancelledListings.slice(i, i + batchSize);
    console.log(`[Cleanup Cancelled Listings] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cancelledListings.length / batchSize)} (${batch.length} listings)`);

    await Promise.all(
      batch.map(async (listing) => {
        try {
          // Safety checks: Verify listing is actually cancelled and not finalized/sold out
          if (listing.status !== "CANCELLED") {
            console.warn(`[Cleanup Cancelled Listings] Skipping listing ${listing.listingId}: status is "${listing.status}", not "CANCELLED"`);
            failed++;
            return;
          }

          if (listing.finalized) {
            console.warn(`[Cleanup Cancelled Listings] Skipping listing ${listing.listingId}: listing is finalized (should not be cancelled if finalized)`);
            failed++;
            return;
          }

          // Check if sold out (for ERC1155)
          const totalSold = parseInt(listing.totalSold || "0");
          const totalAvailable = parseInt(listing.totalAvailable || "0");
          if (totalAvailable > 0 && totalSold >= totalAvailable) {
            console.warn(`[Cleanup Cancelled Listings] Skipping listing ${listing.listingId}: listing is sold out (${totalSold}/${totalAvailable})`);
            failed++;
            return;
          }

          // All safety checks passed - this is a valid cancelled listing
          console.log(`[Cleanup Cancelled Listings] ✓ Listing ${listing.listingId}: status=CANCELLED, finalized=false, sold=${totalSold}/${totalAvailable}`);

          // Fetch metadata to get image URL
          const metadata = await imports.fetchNFTMetadata(
            listing.tokenAddress as Address,
            listing.tokenId,
            listing.tokenSpec
          );

          if (metadata?.image) {
            imageUrls.add(metadata.image);
            console.log(`[Cleanup Cancelled Listings]   → Image URL found: ${metadata.image.substring(0, 80)}...`);
          } else {
            console.warn(`[Cleanup Cancelled Listings]   → No image URL found in metadata`);
          }
          
          processed++;
        } catch (error) {
          console.error(`[Cleanup Cancelled Listings] Error processing listing ${listing.listingId}:`, error);
          failed++;
        }
      })
    );

    // Small delay between batches
    if (i + batchSize < cancelledListings.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Cleanup Cancelled Listings] Found ${imageUrls.size} unique image URLs from cancelled listings`);

  // Delete thumbnails for each image URL
  if (thumbnailCache && imageUrls.size > 0) {
    console.log(`[Cleanup Cancelled Listings] ${dryRun ? 'Checking' : 'Deleting'} thumbnails...`);
    
    for (const imageUrl of imageUrls) {
      try {
        const count = await deleteThumbnailsForImage(db, thumbnailCache, imageUrl, dryRun);
        if (dryRun) {
          thumbnailsFound += count;
        } else {
          thumbnailsDeleted += count;
        }
      } catch (error) {
        console.error(`[Cleanup Cancelled Listings] Error ${dryRun ? 'checking' : 'deleting'} thumbnails for ${imageUrl}:`, error);
        failed++;
      }
    }
  }

  //   // Summary
  console.log(`\n[Cleanup Cancelled Listings] ${dryRun ? 'DRY RUN - ' : ''}Summary:`);
  console.log(`  Total cancelled listings found: ${cancelledListings.length}`);
  console.log(`  Processed listings (verified cancelled): ${processed}`);
  console.log(`  Unique image URLs: ${imageUrls.size}`);
  if (dryRun) {
    console.log(`  Thumbnails found: ${thumbnailsFound}`);
    console.log(`  Would delete: ${thumbnailsFound} thumbnail entries`);
  } else {
    console.log(`  Thumbnails deleted: ${thumbnailsDeleted}`);
  }
  console.log(`  Skipped/Failed: ${failed} (includes non-cancelled, finalized, or sold-out listings)`);
  console.log(`\n  Safety checks applied:`);
  console.log(`    ✓ Status must be "CANCELLED"`);
  console.log(`    ✓ Must not be finalized`);
  console.log(`    ✓ Must not be sold out`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  limit?: number;
  dryRun?: boolean;
  batchSize?: number;
} = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--limit' && i + 1 < args.length) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--batch-size' && i + 1 < args.length) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  }
}

// Run cleanup
cleanupCancelledListingsImages(options)
  .then(() => {
    console.log('[Cleanup Cancelled Listings] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Cleanup Cancelled Listings] Fatal error:', error);
    process.exit(1);
  });

