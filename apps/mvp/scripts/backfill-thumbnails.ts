#!/usr/bin/env tsx
/**
 * Backfill Thumbnails Script
 * 
 * Generates thumbnails for all existing listings that don't have them yet.
 * This is useful for generating thumbnails for listings created before
 * the background generation system was implemented.
 * 
 * Usage:
 *   pnpm tsx scripts/backfill-thumbnails.ts
 *   pnpm tsx scripts/backfill-thumbnails.ts --limit 100 --batch-size 10
 *   pnpm tsx scripts/backfill-thumbnails.ts --skip-cached
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

// Use dynamic imports to work with Next.js path aliases
async function getImports() {
  const [
    { fetchNFTMetadata },
    { generateThumbnailsBackground },
    { getCachedThumbnail },
    { getHiddenUserAddresses },
  ] = await Promise.all([
    import("../src/lib/nft-metadata"),
    import("../src/lib/server/background-thumbnails"),
    import("../src/lib/server/thumbnail-cache"),
    import("../src/lib/server/auction"),
  ]);
  
  return {
    fetchNFTMetadata,
    generateThumbnailsBackground,
    getCachedThumbnail,
    getHiddenUserAddresses,
  };
}

const getSubgraphEndpoint = (): string => {
  const envEndpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
  if (envEndpoint) {
    return envEndpoint;
  }
  throw new Error('Auctionhouse subgraph endpoint not configured. Set NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
};

const getSubgraphHeaders = (): Record<string, string> => {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
};

const ALL_LISTINGS_QUERY = gql`
  query AllListings($first: Int!, $skip: Int!) {
    listings(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      listingId
      seller
      tokenAddress
      tokenId
      tokenSpec
      status
      finalized
      totalAvailable
      totalSold
      createdAt
    }
  }
`;

interface Listing {
  listingId: string;
  seller: string;
  tokenAddress: string;
  tokenId: string;
  tokenSpec: string | number;
  status: string;
  finalized: boolean;
  totalAvailable: string;
  totalSold: string;
  createdAt: string;
}

interface BackfillOptions {
  limit?: number;
  batchSize?: number;
  skipCached?: boolean;
  sizes?: string[];
}

async function fetchAllListings(limit: number = 1000): Promise<Listing[]> {
  const endpoint = getSubgraphEndpoint();
  const headers = getSubgraphHeaders();
  const allListings: Listing[] = [];
  let skip = 0;
  const pageSize = 100;

  console.log(`[Backfill] Fetching listings from subgraph (limit: ${limit})...`);

  while (allListings.length < limit) {
    const remaining = limit - allListings.length;
    const fetchCount = Math.min(pageSize, remaining);

    try {
      const data = await request<{ listings: Listing[] }>(
        endpoint,
        ALL_LISTINGS_QUERY,
        {
          first: fetchCount,
          skip,
        },
        headers
      );

      if (!data.listings || data.listings.length === 0) {
        break; // No more listings
      }

      allListings.push(...data.listings);
      console.log(`[Backfill] Fetched ${allListings.length} listings so far...`);

      if (data.listings.length < fetchCount) {
        break; // Reached end of listings
      }

      skip += fetchCount;
    } catch (error) {
      console.error(`[Backfill] Error fetching listings:`, error);
      break;
    }
  }

  return allListings;
}

async function processListing(
  listing: Listing,
  options: BackfillOptions,
  imports: Awaited<ReturnType<typeof getImports>>
): Promise<{ success: boolean; cached: boolean; error?: string }> {
  const { skipCached = false, sizes = ['small', 'medium'] } = options;
  const { fetchNFTMetadata, generateThumbnailsBackground, getCachedThumbnail } = imports;

  try {
    // Normalize tokenSpec
    let tokenSpec: "ERC721" | "ERC1155" = "ERC721";
    if (listing.tokenSpec === 2 || listing.tokenSpec === "2" || listing.tokenSpec === "ERC1155") {
      tokenSpec = "ERC1155";
    }

    // Fetch metadata to get image URL
    const metadata = await fetchNFTMetadata(
      listing.tokenAddress as Address,
      listing.tokenId,
      tokenSpec
    );

    if (!metadata?.image) {
      return { success: false, cached: false, error: 'No image in metadata' };
    }

    const imageUrl = metadata.image;

    // Check if already cached
    if (!skipCached) {
      const cached = await getCachedThumbnail(imageUrl, 'small');
      if (cached) {
        return { success: true, cached: true };
      }
    }

    // Generate thumbnails
    await generateThumbnailsBackground(imageUrl, listing.listingId, sizes);
    return { success: true, cached: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, cached: false, error: errorMessage };
  }
}

async function backfillThumbnails(options: BackfillOptions = {}) {
  const {
    limit = 1000,
    batchSize = 10,
    skipCached = false,
    sizes = ['small', 'medium'],
  } = options;

  console.log(`[Backfill] Starting thumbnail backfill...`);
  console.log(`[Backfill] Options:`, { limit, batchSize, skipCached, sizes });

  // Get imports
  const imports = await getImports();

  // Fetch all listings
  const listings = await fetchAllListings(limit);

  // Filter out inactive listings
  const hiddenAddresses = await imports.getHiddenUserAddresses();
  const activeListings = listings.filter((listing) => {
    // Exclude cancelled
    if (listing.status === 'CANCELLED') return false;
    
    // Exclude finalized
    if (listing.finalized) return false;
    
    // Exclude sold-out
    const totalAvailable = parseInt(listing.totalAvailable || '0');
    const totalSold = parseInt(listing.totalSold || '0');
    if (totalAvailable > 0 && totalSold >= totalAvailable) return false;
    
    // Exclude hidden users
    if (hiddenAddresses.has(listing.seller?.toLowerCase())) return false;
    
    return true;
  });

  console.log(`[Backfill] Found ${activeListings.length} active listings (filtered from ${listings.length} total)`);

  // Process in batches
  let processed = 0;
  let successful = 0;
  let cached = 0;
  let failed = 0;

  for (let i = 0; i < activeListings.length; i += batchSize) {
    const batch = activeListings.slice(i, i + batchSize);
    console.log(`[Backfill] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeListings.length / batchSize)} (${batch.length} listings)...`);

    const results = await Promise.allSettled(
      batch.map((listing) => processListing(listing, { skipCached, sizes }, imports))
    );

    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          if (result.value.cached) {
            cached++;
          } else {
            successful++;
          }
        } else {
          failed++;
          console.warn(`[Backfill] Failed: ${result.value.error}`);
        }
      } else {
        failed++;
        console.warn(`[Backfill] Error:`, result.reason);
      }
    }

    console.log(`[Backfill] Progress: ${processed}/${activeListings.length} (${successful} generated, ${cached} cached, ${failed} failed)`);

    // Small delay between batches to avoid overwhelming the system
    if (i + batchSize < activeListings.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Backfill] Complete!`);
  console.log(`[Backfill] Summary:`);
  console.log(`  - Processed: ${processed}`);
  console.log(`  - Generated: ${successful}`);
  console.log(`  - Already cached: ${cached}`);
  console.log(`  - Failed: ${failed}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: BackfillOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--batch-size' && args[i + 1]) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--skip-cached') {
    options.skipCached = true;
  } else if (arg === '--sizes' && args[i + 1]) {
    options.sizes = args[i + 1].split(',');
    i++;
  }
}

// Run the backfill
backfillThumbnails(options)
  .then(() => {
    console.log('[Backfill] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Backfill] Script failed:', error);
    process.exit(1);
  });

