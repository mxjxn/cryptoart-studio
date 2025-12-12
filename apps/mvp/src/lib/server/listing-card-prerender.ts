/**
 * Pre-render listing card data
 * Processes and caches static listing card data (image, title, description, artist)
 * Dynamic auction data (bids, prices, status) is loaded separately
 */

import { getAuctionServer } from './auction';
import { getCachedImage, cacheImage } from './image-cache';
import { processMediaForImage } from './media-processor';
import { fetchNFTMetadata } from '../nft-metadata';
import type { EnrichedAuctionData } from '../types';

export interface PrerenderedListingCardData {
  listingId: string;
  thumbnailUrl: string | null; // Processed image data URL
  title: string;
  description: string | null;
  artist: string | null;
  tokenAddress: string;
  tokenId: string | null;
  listingType: string;
  initialAmount: string;
  tokenSpec: string;
  seller: string;
  createdAt: string;
  // Metadata for rendering
  processedAt: Date;
}

// In-memory cache for pre-rendered listing cards
// In production, this could be moved to Redis or a database table
const LISTING_CARD_CACHE = new Map<string, PrerenderedListingCardData>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get pre-rendered listing card data
 */
export async function getPrerenderedListingCardData(
  listingId: string
): Promise<PrerenderedListingCardData | null> {
  // Check in-memory cache first
  const cached = LISTING_CARD_CACHE.get(listingId);
  if (cached) {
    const age = Date.now() - cached.processedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return cached;
    }
    // Expired, remove from cache
    LISTING_CARD_CACHE.delete(listingId);
  }
  
  return null;
}

/**
 * Pre-render listing card data for a listing
 * Processes the image, extracts static metadata, and caches it
 */
export async function prerenderListingCardData(
  listingId: string
): Promise<PrerenderedListingCardData | null> {
  try {
    console.log(`[Listing Card Prerender] Pre-rendering card data for listing ${listingId}...`);
    
    // Fetch listing data
    const listing = await getAuctionServer(listingId);
    if (!listing) {
      console.warn(`[Listing Card Prerender] Listing ${listingId} not found`);
      return null;
    }
    
    // Extract static data
    const imageUrl = listing.thumbnailUrl || listing.image || listing.metadata?.image;
    
    // Process image if available
    let thumbnailUrl: string | null = null;
    if (imageUrl) {
      // Check cache first
      const cachedImage = await getCachedImage(imageUrl);
      if (cachedImage) {
        thumbnailUrl = cachedImage;
      } else {
        // Fetch and process image
        try {
          // Convert IPFS URLs to HTTP gateway URLs
          let httpUrl = imageUrl;
          if (imageUrl.startsWith('ipfs://')) {
            const hash = imageUrl.replace('ipfs://', '');
            const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
            httpUrl = `${gateway}/ipfs/${hash}`;
          } else if (imageUrl.includes('/ipfs/') && !imageUrl.startsWith('http')) {
            const hash = imageUrl.split('/ipfs/')[1]?.split('/')[0];
            if (hash) {
              const gateway = process.env.IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://cloudflare-ipfs.com';
              httpUrl = `${gateway}/ipfs/${hash}`;
            }
          }
          
          // Fetch image
          const response = await fetch(httpUrl, {
            headers: {
              'User-Agent': 'CryptoArt-CardPrerender/1.0',
            },
            signal: AbortSignal.timeout(15000), // 15 second timeout
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Process media (handles images, videos, GIFs)
            const processed = await processMediaForImage(buffer, contentType, imageUrl);
            if (processed) {
              thumbnailUrl = processed.dataUrl;
              
              // Cache the processed image
              await cacheImage(imageUrl, processed.dataUrl, 'image/png');
            }
          }
        } catch (error) {
          console.warn(
            `[Listing Card Prerender] Error processing image for listing ${listingId}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
    
    // Build pre-rendered data
    const prerendered: PrerenderedListingCardData = {
      listingId,
      thumbnailUrl,
      title: listing.title || listing.metadata?.title || `Listing #${listingId}`,
      description: listing.metadata?.description || listing.description || null,
      artist: listing.artist || listing.metadata?.artist || null,
      tokenAddress: listing.tokenAddress,
      tokenId: listing.tokenId || null,
      listingType: listing.listingType || 'INDIVIDUAL_AUCTION',
      initialAmount: listing.initialAmount || '0',
      tokenSpec: String(listing.tokenSpec),
      seller: listing.seller,
      createdAt: listing.createdAt || new Date().toISOString(),
      processedAt: new Date(),
    };
    
    // Cache in memory
    LISTING_CARD_CACHE.set(listingId, prerendered);
    
    console.log(`[Listing Card Prerender] Successfully pre-rendered card data for listing ${listingId}`);
    return prerendered;
  } catch (error) {
    console.error(
      `[Listing Card Prerender] Error pre-rendering card data for listing ${listingId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Pre-render listing card data if it doesn't exist or is expired
 */
export async function prerenderListingCardDataIfNeeded(
  listingId: string
): Promise<PrerenderedListingCardData | null> {
  // Check if already cached
  const cached = await getPrerenderedListingCardData(listingId);
  if (cached) {
    return cached;
  }
  
  // Pre-render if not cached
  return await prerenderListingCardData(listingId);
}

/**
 * Pre-render listing cards for multiple listings in batch
 */
export async function prerenderListingCardDataBatch(
  listingIds: string[],
  concurrency: number = 3
): Promise<void> {
  console.log(`[Listing Card Prerender] Starting batch pre-render for ${listingIds.length} listings...`);
  
  // Process in batches to avoid overwhelming the server
  for (let i = 0; i < listingIds.length; i += concurrency) {
    const batch = listingIds.slice(i, i + concurrency);
    await Promise.all(
      batch.map(listingId => prerenderListingCardData(listingId))
    );
    
    // Small delay between batches
    if (i + concurrency < listingIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[Listing Card Prerender] Completed batch pre-render for ${listingIds.length} listings`);
}

/**
 * Clear expired entries from cache
 */
export function clearExpiredListingCardCache(): void {
  const now = Date.now();
  for (const [listingId, data] of LISTING_CARD_CACHE.entries()) {
    const age = now - data.processedAt.getTime();
    if (age >= CACHE_TTL_MS) {
      LISTING_CARD_CACHE.delete(listingId);
    }
  }
}
