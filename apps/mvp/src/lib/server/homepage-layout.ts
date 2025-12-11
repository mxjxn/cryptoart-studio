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
import { getAuctionServer, fetchActiveAuctionsUncached } from '~/lib/server/auction';
import { browseListings } from '~/lib/server/browse-listings';

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
        // Show auctions that are currently live (started but not ended)
        // Or auctions that haven't started yet (upcoming)
        const isUpcoming = start > now;
        const isLive = start > 0 && start <= now && (end === 0 || end > now || end >= 281474976710655); // 281474976710655 is MAX_UINT48 (never expires)
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
    const active = await fetchActiveAuctionsUncached(limit * 2, 0, true);
    return active
      .filter((auction) => (auction.bidCount || 0) > 0 || !!auction.highestBid)
      .slice(0, limit);
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

