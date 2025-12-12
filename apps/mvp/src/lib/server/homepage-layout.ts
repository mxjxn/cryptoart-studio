import { gql, request } from 'graphql-request';
import {
  asc,
  eq,
  featuredSectionItems,
  featuredSections,
  getDatabase,
  homepageLayoutSections,
} from '@cryptoart/db';
import type { EnrichedAuctionData } from '~/lib/types';
import { getAuctionServer, fetchActiveAuctionsUncached, normalizeListingType, normalizeTokenSpec, getHiddenUserAddresses } from '~/lib/server/auction';
import { browseListings } from '~/lib/server/browse-listings';
import { fetchNFTMetadata } from '~/lib/nft-metadata';
import { type Address } from 'viem';

type SectionType =
  | 'upcoming_auctions'
  | 'recently_concluded'
  | 'live_bids'
  | 'artist'
  | 'gallery'
  | 'collector'
  | 'listing'
  | 'featured_carousel'
  | 'custom_section';

export interface HomepageSection {
  id: string;
  sectionType: SectionType;
  title?: string | null;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  listings: EnrichedAuctionData[];
}

const DEFAULT_LIMIT = 12;

/**
 * Get all homepage layout sections (optionally including inactive)
 */
export async function getHomepageLayoutSections(includeInactive = false) {
  const db = getDatabase();
  const query = db.select().from(homepageLayoutSections).orderBy(asc(homepageLayoutSections.displayOrder));
  if (includeInactive) {
    return query;
  }
  return query.where(eq(homepageLayoutSections.isActive, true));
}

/**
 * Resolve homepage sections with listings
 */
export async function resolveHomepageSections(includeInactive = false): Promise<HomepageSection[]> {
  const sections = await getHomepageLayoutSections(includeInactive);
  const resolved = await Promise.all(
    sections.map(async (section) => {
      const config = (section as any)?.config as Record<string, any> | null | undefined;
      const listings = await resolveSectionListings(section.sectionType as SectionType, config);
      return {
        ...section,
        listings,
      } as HomepageSection;
    })
  );

  // Return all sections, even if they have no listings
  // This allows admins to see their configured sections on the homepage
  // The frontend will handle displaying empty state messages
  return resolved;
}

async function resolveSectionListings(sectionType: SectionType, config?: Record<string, any> | null) {
  switch (sectionType) {
    case 'upcoming_auctions':
      return getUpcomingAuctions(config?.limit ?? DEFAULT_LIMIT, config?.displayFormat);
    case 'recently_concluded':
      return getRecentlyConcluded(config?.limit ?? DEFAULT_LIMIT);
    case 'live_bids':
      return getLiveBids(config?.limit ?? DEFAULT_LIMIT);
    case 'artist':
      return getListingsBySeller(config?.name, config?.limit ?? DEFAULT_LIMIT);
    case 'gallery':
      return getGalleryListings(config?.curatorAddress, config?.stubname, config?.limit ?? DEFAULT_LIMIT);
    case 'collector':
      return getCollectorListings(config?.name, config?.limit ?? DEFAULT_LIMIT);
    case 'listing':
      return getSingleListing(config?.listingId);
    case 'featured_carousel':
      return getFeaturedCarouselListings();
    case 'custom_section':
      return getCustomSectionListings(config?.sectionId, config?.limit);
    default:
      return [];
  }
}

async function getUpcomingAuctions(limit: number, _displayFormat?: string): Promise<EnrichedAuctionData[]> {
  try {
    // Get active auctions (status: ACTIVE, finalized: false)
    const active = await fetchActiveAuctionsUncached(limit * 2, 0, true);
    
    const now = Math.floor(Date.now() / 1000);
    return active
      .filter((listing) => {
        const start = parseInt(String(listing.startTime || 0));
        const end = parseInt(String(listing.endTime || 0));
        const MAX_UINT48 = 281474976710655;
        
        // Show auctions that are currently live (started but not ended)
        // Or auctions that haven't started yet (upcoming)
        
        // If startTime is 0, it means the auction started immediately (no start time restriction)
        // In this case, check if it hasn't ended yet
        if (start === 0) {
          return end === 0 || end > now || end >= MAX_UINT48;
        }
        
        // If startTime > 0, check if it's upcoming or currently live
        const isUpcoming = start > now;
        const isLive = start <= now && (end === 0 || end > now || end >= MAX_UINT48);
        return isUpcoming || isLive;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get upcoming auctions', error);
    return [];
  }
}

// Re-use query from recently-concluded API
const RECENTLY_CONCLUDED_QUERY = gql`
  query RecentlyConcluded($since: BigInt!, $first: Int!, $skip: Int!) {
    listings(
      where: {
        status: "FINALIZED"
        finalized: true
        updatedAt_gte: $since
      }
      first: $first
      skip: $skip
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

// Query for listings with bids - filters by hasBid: true to get all listings with bids
// regardless of creation date, ordered by updatedAt desc so recently bid-on listings appear first
const LISTINGS_WITH_BIDS_QUERY = gql`
  query ListingsWithBids($first: Int!, $skip: Int!) {
    listings(
      where: { status: "ACTIVE", finalized: false, hasBid: true }
      first: $first
      skip: $skip
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      listingId
      marketplace
      seller
      tokenAddress
      tokenId
      tokenSpec
      listingType
      initialAmount
      totalAvailable
      totalPerSale
      startTime
      endTime
      lazy
      status
      totalSold
      hasBid
      finalized
      createdAt
      createdAtBlock
      updatedAt
      erc20
      bids(orderBy: amount, orderDirection: desc, first: 1000) {
        id
        bidder
        amount
        timestamp
      }
    }
  }
`;

async function getRecentlyConcluded(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    const endpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
    if (!endpoint) {
      throw new Error('Missing NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
    }

    const now = Math.floor(Date.now() / 1000);
    const since = now - 60 * 60 * 24 * 30; // last 30 days

    const data = await request<{ listings: any[] }>(
      endpoint,
      RECENTLY_CONCLUDED_QUERY,
      { since, first: limit, skip: 0 },
      getSubgraphHeaders()
    );

    return data.listings?.map((listing) => ({
      ...listing,
      listingType: listing.listingType,
      bidCount: listing.bids?.length || 0,
      highestBid: listing.bids && listing.bids.length > 0 ? listing.bids[0] : undefined,
    })) as EnrichedAuctionData[];
  } catch (error) {
    console.error('[Homepage] Failed to get recently concluded auctions', error);
    return [];
  }
}

async function getLiveBids(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    // Query subgraph directly for listings with bids - this ensures we get ALL listings with bids
    // regardless of creation date, and scales to any number of listings
    // Ordered by updatedAt desc so recently bid-on listings appear first
    const endpoint = process.env.NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL;
    if (!endpoint) {
      throw new Error('Missing NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL');
    }

    console.log(`[getLiveBids] Querying subgraph for listings with bids (limit: ${limit})`);
    
    const data = await request<{ listings: any[] }>(
      endpoint,
      LISTINGS_WITH_BIDS_QUERY,
      {
        first: limit,
        skip: 0,
      },
      getSubgraphHeaders()
    );

    console.log(`[getLiveBids] Subgraph returned ${data.listings?.length || 0} listings with bids`);

    if (!data.listings || data.listings.length === 0) {
      console.log(`[getLiveBids] No listings returned from subgraph query with hasBid: true`);
      return [];
    }

    // Log listing IDs for debugging
    const listingIds = data.listings.map(l => l.listingId);
    console.log(`[getLiveBids] Listing IDs from subgraph: ${listingIds.join(', ')}`);

    // Get hidden user addresses to filter out
    const hiddenAddresses = await getHiddenUserAddresses();

    // Filter out hidden users and fully sold listings
    // Also verify that bids actually exist (defensive check in case hasBid field is wrong)
    const now = Math.floor(Date.now() / 1000);
    const MAX_UINT48 = 281474976710655;
    
    const filteredListings = data.listings.filter((listing) => {
      // Verify bids actually exist (defensive check)
      const bidCount = listing.bids?.length || 0;
      const hasBidField = listing.hasBid === true;
      if (!hasBidField && bidCount === 0) {
        console.log(`[getLiveBids] Listing ${listing.listingId} has hasBid=false and no bids, skipping`);
        return false;
      }

      const totalAvailable = parseInt(listing.totalAvailable || "0");
      const totalSold = parseInt(listing.totalSold || "0");
      const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;
      
      if (listing.finalized || isFullySold) {
        console.log(`[getLiveBids] Listing ${listing.listingId} filtered: finalized=${listing.finalized}, isFullySold=${isFullySold}`);
        return false;
      }
      
      // Check if auction has ended - for ERC721 (1/1), if it ended with a bid, it's likely finalized
      // even if subgraph hasn't synced yet. This prevents showing finalized auctions that subgraph
      // hasn't updated yet.
      const endTime = parseInt(listing.endTime || "0");
      const isERC721 = listing.tokenSpec === "ERC721" || String(listing.tokenSpec) === "1";
      const hasEnded = endTime > 0 && endTime < now && endTime < MAX_UINT48;
      
      if (hasEnded && isERC721 && bidCount > 0) {
        // For 1/1 auctions that ended with bids, they're likely finalized even if subgraph hasn't synced
        // Only filter if it ended more than 1 hour ago to allow for finalization grace period
        const endedAgo = now - endTime;
        const oneHour = 60 * 60;
        if (endedAgo > oneHour) {
          console.log(`[getLiveBids] Listing ${listing.listingId} filtered: ERC721 auction ended ${Math.floor(endedAgo / 3600)} hours ago with bid, likely finalized`);
          return false;
        }
      }
      
      if (listing.seller && hiddenAddresses.has(listing.seller.toLowerCase())) {
        console.log(`[getLiveBids] Listing ${listing.listingId} filtered: seller is hidden`);
        return false;
      }
      
      return true;
    });

    // Enrich listings with metadata and bid information (same as fetchActiveAuctions)
    const enrichedListings = await Promise.all(
      filteredListings.map(async (listing) => {
        const bidCount = listing.bids?.length || 0;
        const highestBid = listing.bids && listing.bids.length > 0 
          ? listing.bids[0] // Already sorted by amount desc
          : undefined;

        // Fetch NFT metadata
        let metadata = null;
        if (listing.tokenAddress && listing.tokenId) {
          try {
            metadata = await fetchNFTMetadata(
              listing.tokenAddress as Address,
              listing.tokenId,
              listing.tokenSpec
            );
          } catch (error) {
            console.error(`[getLiveBids] Error fetching metadata for ${listing.tokenAddress}:${listing.tokenId}:`, error);
          }
        }

        // Fetch ERC1155 total supply if applicable
        let erc1155TotalSupply: string | undefined = undefined;
        if ((listing.tokenSpec === "ERC1155" || listing.tokenSpec === 2) && listing.tokenAddress && listing.tokenId) {
          try {
            const { getERC1155TotalSupply } = await import('~/lib/server/erc1155-supply');
            const totalSupply = await getERC1155TotalSupply(
              listing.tokenAddress,
              listing.tokenId
            );
            if (totalSupply !== null) {
              erc1155TotalSupply = totalSupply.toString();
            }
          } catch (error: any) {
            // Optional enrichment - continue without it
          }
        }

        // Fetch ERC721 collection total supply if applicable
        let erc721TotalSupply: number | undefined = undefined;
        if ((listing.tokenSpec === "ERC721" || listing.tokenSpec === 1) && listing.tokenAddress) {
          try {
            const { fetchERC721TotalSupply } = await import('~/lib/erc721-supply');
            const totalSupply = await fetchERC721TotalSupply(listing.tokenAddress);
            if (totalSupply !== null) {
              erc721TotalSupply = totalSupply;
            }
          } catch (error: any) {
            // Optional enrichment - continue without it
          }
        }

        // Generate thumbnail
        let thumbnailUrl: string | undefined = undefined;
        const imageUrl = metadata?.image;
        if (imageUrl && listing.status !== "CANCELLED") {
          try {
            const { getOrGenerateThumbnail } = await import('./thumbnail-generator');
            thumbnailUrl = await getOrGenerateThumbnail(imageUrl, 'small');
          } catch (error) {
            thumbnailUrl = imageUrl; // Fall back to original image
          }
        }

        const enriched: EnrichedAuctionData = {
          ...listing,
          listingType: normalizeListingType(listing.listingType, listing),
          tokenSpec: normalizeTokenSpec(listing.tokenSpec),
          bidCount,
          highestBid: highestBid ? {
            amount: highestBid.amount,
            bidder: highestBid.bidder,
            timestamp: highestBid.timestamp,
          } : undefined,
          title: metadata?.title || metadata?.name,
          artist: metadata?.artist || metadata?.creator,
          image: metadata?.image,
          description: metadata?.description,
          thumbnailUrl,
          metadata,
          erc1155TotalSupply,
          erc721TotalSupply,
        };

        return enriched;
      })
    );

    console.log(`[getLiveBids] Returning ${enrichedListings.length} enriched listings with bids`);
    return enrichedListings;
  } catch (error) {
    console.error('[Homepage] Failed to get live bids', error);
    return [];
  }
}

async function getListingsBySeller(seller?: string, limit: number = DEFAULT_LIMIT): Promise<EnrichedAuctionData[]> {
  if (!seller) return [];
  try {
    const { listings } = await browseListings({
      first: limit * 2,
      skip: 0,
      orderBy: 'createdAt',
      orderDirection: 'desc',
      enrich: true,
    });
    return listings.filter((l) => l.seller?.toLowerCase() === seller.toLowerCase()).slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get listings by seller', error);
    return [];
  }
}

async function getGalleryListings(curatorAddress?: string, stubname?: string, limit: number = DEFAULT_LIMIT) {
  if (!curatorAddress || !stubname) return [];
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/curation/slug/${stubname}?curatorAddress=${curatorAddress}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    const listings = (data.gallery?.listings || []) as EnrichedAuctionData[];
    return listings.slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get gallery listings', error);
    return [];
  }
}

async function getCollectorListings(collector?: string, limit: number = DEFAULT_LIMIT) {
  if (!collector) return [];
  try {
    const { listings } = await browseListings({
      first: limit * 2,
      skip: 0,
      orderBy: 'createdAt',
      orderDirection: 'desc',
      enrich: true,
    });
    return listings
      .filter((listing) => listing.highestBid?.bidder?.toLowerCase() === collector.toLowerCase())
      .slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get collector listings', error);
    return [];
  }
}

async function getSingleListing(listingId?: string) {
  if (!listingId) return [];
  try {
    const listing = await getAuctionServer(listingId);
    return listing ? [listing] : [];
  } catch (error) {
    console.error('[Homepage] Failed to get listing by id', error);
    return [];
  }
}

async function getFeaturedCarouselListings() {
  // Featured carousel is deprecated - use galleries via homepage arranger instead
  // Return empty array for graceful degradation
  return [];
}

async function getCustomSectionListings(sectionId?: string, limit?: number) {
  if (!sectionId) return [];
  try {
    const db = getDatabase();
    const [section] = await db
      .select()
      .from(featuredSections)
      .where(eq(featuredSections.id, sectionId))
      .limit(1);

    if (!section) return [];

    const items = await db
      .select()
      .from(featuredSectionItems)
      .where(eq(featuredSectionItems.sectionId, sectionId))
      .orderBy(asc(featuredSectionItems.displayOrder));

    const listings = await Promise.all(
      items.map(async (item) => {
        const listing = await getAuctionServer(item.itemId);
        return listing ? { ...listing, displayOrder: item.displayOrder } : null;
      })
    );

    const finalLimit = limit || DEFAULT_LIMIT;
    return listings.filter(Boolean).slice(0, finalLimit) as EnrichedAuctionData[];
  } catch (error) {
    console.error('[Homepage] Failed to get custom section listings', error);
    return [];
  }
}

function getSubgraphHeaders(): Record<string, string> {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
}

