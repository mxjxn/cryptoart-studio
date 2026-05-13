import { gql } from 'graphql-request';
import {
  and,
  asc,
  desc,
  eq,
  curation,
  curationItems,
  featuredListings,
  featuredSectionItems,
  featuredSections,
  getDatabase,
  homepageLayoutSections,
  sql,
} from '@cryptoart/db';
import type { EnrichedAuctionData } from '~/lib/types';
import {
  getAuctionServer,
  fetchActiveAuctionsUncached,
  normalizeListingType,
  normalizeTokenSpec,
  getHiddenUserAddresses,
  isListingBlockedFromProduct,
} from '~/lib/server/auction';
import { browseListings } from '~/lib/server/browse-listings';
import { enrichListingRowsForCardsLight } from '~/lib/server/listing-card-enrichment';
import {
  queryListingsAcrossChains,
  sortMergedListingsByField,
} from '~/lib/server/subgraph-multi-query';
import { BASE_CHAIN_ID } from '~/lib/server/subgraph-endpoints';
import { unstable_cache } from "next/cache";
import { lookupNeynarByAddress, lookupNeynarByUsername } from "~/lib/artist-name-resolution";
import { getListingMediaSnapshot, primeListingMediaSnapshot } from "~/lib/server/listing-metadata-refresh";
import { getListingPreviewsByIds } from "~/lib/server/listing-preview-store";
import { withTimeout } from "~/lib/utils";

type SectionType =
  | 'upcoming_auctions'
  | 'recently_concluded'
  | 'live_bids'
  | 'artist'
  | 'gallery'
  | 'collector'
  | 'listing'
  | 'featured_carousel'
  | 'custom_section'
  | 'recent_listings'
  | 'ending_soon'
  | 'awaiting_bids'
  | 'recent_galleries';

export interface HomepageSection {
  id: string;
  sectionType: SectionType;
  title?: string | null;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  surface?: string;
  listings: EnrichedAuctionData[];
}

const DEFAULT_LIMIT = 12;

export type LayoutSurface = 'home' | 'market';

/**
 * Layout rows for a surface (`home` = homepage, `market` = /market rails).
 */
export async function getLayoutSections(
  surface: LayoutSurface,
  includeInactive = false
) {
  const db = getDatabase();
  if (includeInactive) {
    return db
      .select()
      .from(homepageLayoutSections)
      .where(eq(homepageLayoutSections.surface, surface))
      .orderBy(asc(homepageLayoutSections.displayOrder));
  }
  return db
    .select()
    .from(homepageLayoutSections)
    .where(
      and(eq(homepageLayoutSections.surface, surface), eq(homepageLayoutSections.isActive, true))
    )
    .orderBy(asc(homepageLayoutSections.displayOrder));
}

/**
 * @deprecated Use {@link getLayoutSections} with surface `'home'`.
 */
export async function getHomepageLayoutSections(includeInactive = false) {
  return getLayoutSections('home', includeInactive);
}

/**
 * Resolve homepage (surface `home`) sections with listings.
 */
export async function resolveHomepageSections(includeInactive = false): Promise<HomepageSection[]> {
  return resolveLayoutSections('home', includeInactive);
}

/** Resolve layout sections for homepage or market surface. */
export async function resolveLayoutSections(
  surface: LayoutSurface,
  includeInactive = false
): Promise<HomepageSection[]> {
  const sections = await getLayoutSections(surface, includeInactive);
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

export async function resolveMarketSections(
  includeInactive = false
): Promise<HomepageSection[]> {
  return resolveLayoutSections("market", includeInactive);
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
      return getSingleListing(config?.listingId, config?.chainId);
    case 'featured_carousel':
      return getFeaturedCarouselListings();
    case 'custom_section':
      return getCustomSectionListings(config?.sectionId, config?.limit);
    case 'recent_listings':
      return getRecentListings(config?.limit ?? 6);
    case 'ending_soon':
      return getEndingSoon(config?.limit ?? DEFAULT_LIMIT, config?.windowSec);
    case 'awaiting_bids':
      return getAwaitingBids(config?.limit ?? DEFAULT_LIMIT);
    case 'recent_galleries':
      return getRecentGalleriesListings(config?.limit ?? DEFAULT_LIMIT);
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
        // Filter out cancelled listings
        if (listing.status === 'CANCELLED') {
          return false;
        }
        
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

const LISTINGS_AWAITING_BIDS_QUERY = gql`
  query ListingsAwaitingBids($first: Int!, $skip: Int!) {
    listings(
      where: { status: "ACTIVE", finalized: false, hasBid: false }
      first: $first
      skip: $skip
      orderBy: createdAt
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

const ENDING_SOON_QUERY = gql`
  query EndingSoon($now: BigInt!, $until: BigInt!, $first: Int!) {
    listings(
      where: {
        status: "ACTIVE"
        finalized: false
        startTime_gt: "0"
        endTime_gt: $now
        endTime_lt: $until
      }
      first: $first
      skip: 0
      orderBy: endTime
      orderDirection: asc
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
    const now = Math.floor(Date.now() / 1000);
    const since = now - 60 * 60 * 24 * 30;
    const fetchN = Math.min(Math.max(limit * 4, 40), 200);
    const multi = await queryListingsAcrossChains(RECENTLY_CONCLUDED_QUERY, {
      since: String(since),
      first: fetchN,
      skip: 0,
    });
    if (!multi.anyEndpointSucceeded || multi.listings.length === 0) return [];

    sortMergedListingsByField(multi.listings, "updatedAt", "desc");
    const hiddenAddresses = await getHiddenUserAddresses();
    const filtered = multi.listings
      .filter((listing) => !isListingBlockedFromProduct(listing, hiddenAddresses))
      .slice(0, limit);

    return enrichListingRowsForCardsLight(filtered);
  } catch (error) {
    console.error("[Homepage] Failed to get recently concluded auctions", error);
    return [];
  }
}

async function getLiveBids(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    const fetchN = Math.min(Math.max(limit * 4, 40), 200);
    const multi = await queryListingsAcrossChains(LISTINGS_WITH_BIDS_QUERY, {
      first: fetchN,
      skip: 0,
    });

    if (multi.listings.length === 0) {
      return [];
    }

    sortMergedListingsByField(multi.listings, "updatedAt", "desc");

    const hiddenAddresses = await getHiddenUserAddresses();
    const now = Math.floor(Date.now() / 1000);
    const MAX_UINT48 = 281474976710655;

    const filteredListings = multi.listings.filter((listing) => {
      if (isListingBlockedFromProduct(listing, hiddenAddresses)) return false;
      if (listing.status === "CANCELLED") {
        return false;
      }

      const bidCount = listing.bids?.length || 0;
      const hasBidField = listing.hasBid === true;
      if (!hasBidField && bidCount === 0) {
        return false;
      }

      const totalAvailable = parseInt(listing.totalAvailable || "0");
      const totalSold = parseInt(listing.totalSold || "0");
      const isFullySold = totalAvailable > 0 && totalSold >= totalAvailable;

      if (listing.finalized || isFullySold) {
        return false;
      }

      const startTime = parseInt(listing.startTime || "0");
      const endTime = parseInt(listing.endTime || "0");
      const isERC721 = listing.tokenSpec === "ERC721" || String(listing.tokenSpec) === "1";

      let actualEndTime: number;
      if (startTime === 0 && bidCount > 0) {
        const ONE_YEAR_IN_SECONDS = 31536000;
        if (endTime > now) {
          actualEndTime = endTime;
        } else if (endTime <= ONE_YEAR_IN_SECONDS) {
          const firstBidTimestamp =
            listing.bids && listing.bids.length > 0
              ? parseInt(listing.bids[listing.bids.length - 1]?.timestamp || "0")
              : now;
          actualEndTime = firstBidTimestamp + endTime;
        } else {
          actualEndTime = endTime;
        }
      } else if (startTime === 0 && bidCount === 0) {
        actualEndTime = 0;
      } else {
        actualEndTime = endTime;
      }

      const hasEnded = actualEndTime > 0 && actualEndTime < now && actualEndTime < MAX_UINT48;

      if (hasEnded && isERC721 && bidCount > 0) {
        const endedAgo = now - actualEndTime;
        const oneHour = 60 * 60;
        if (endedAgo > oneHour) {
          return false;
        }
      }

      return true;
    });

    return enrichListingRowsForCardsLight(filteredListings.slice(0, limit));
  } catch (error) {
    console.error("[Homepage] Failed to get live bids", error);
    return [];
  }
}

async function getAwaitingBids(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    const fetchN = Math.min(Math.max(limit * 4, 40), 200);
    const multi = await queryListingsAcrossChains(LISTINGS_AWAITING_BIDS_QUERY, {
      first: fetchN,
      skip: 0,
    });
    if (multi.listings.length === 0) return [];

    sortMergedListingsByField(multi.listings, "createdAt", "desc");
    const hiddenAddresses = await getHiddenUserAddresses();
    const filtered = multi.listings
      .filter((listing) => {
        if (isListingBlockedFromProduct(listing, hiddenAddresses)) return false;
        if (listing.status === "CANCELLED") return false;
        const bidCount = listing.bids?.length || 0;
        if (listing.hasBid === true || bidCount > 0) return false;
        return true;
      })
      .slice(0, limit);

    return enrichListingRowsForCardsLight(filtered);
  } catch (e) {
    console.error("[Homepage] Failed to get awaiting bids", e);
    return [];
  }
}

async function getEndingSoon(limit: number, windowSec: number = 7 * 24 * 60 * 60): Promise<EnrichedAuctionData[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const until = now + windowSec;
    const fetchN = Math.min(Math.max(limit * 6, 60), 200);
    const multi = await queryListingsAcrossChains(ENDING_SOON_QUERY, {
      now: String(now),
      until: String(until),
      first: fetchN,
    });
    if (multi.listings.length === 0) return [];

    sortMergedListingsByField(multi.listings, "endTime", "asc");
    const hiddenAddresses = await getHiddenUserAddresses();
    const filtered = multi.listings
      .filter((listing) => {
        if (isListingBlockedFromProduct(listing, hiddenAddresses)) return false;
        if (listing.status !== "ACTIVE" || listing.finalized) return false;
        const endTime = parseInt(listing.endTime || "0", 10);
        const startTime = parseInt(listing.startTime || "0", 10);
        if (startTime === 0) return false;
        return endTime > now && endTime <= until;
      })
      .slice(0, limit);

    return enrichListingRowsForCardsLight(filtered);
  } catch (e) {
    console.error("[Homepage] Failed to get ending soon", e);
    return [];
  }
}

async function getRecentGalleriesListings(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    const db = getDatabase();
    const galleries = await db
      .select()
      .from(curation)
      .where(eq(curation.isPublished, true))
      .orderBy(desc(curation.updatedAt))
      .limit(Math.max(limit * 3, 12));

    const cards: EnrichedAuctionData[] = [];
    for (const g of galleries) {
      if (!g.slug) continue;
      const one = await getGalleryListings(g.curatorAddress, g.slug, 1);
      if (one[0]) cards.push(one[0]);
      if (cards.length >= limit) break;
    }
    return cards.slice(0, limit);
  } catch (e) {
    console.error("[Homepage] Failed to get recent galleries", e);
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
    return listings
      .filter((l) => {
        // Filter out cancelled listings
        if (l.status === 'CANCELLED') {
          return false;
        }
        return l.seller?.toLowerCase() === seller.toLowerCase();
      })
      .slice(0, limit);
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
      .filter((listing) => {
        // Filter out cancelled listings
        if (listing.status === 'CANCELLED') {
          return false;
        }
        return listing.highestBid?.bidder?.toLowerCase() === collector.toLowerCase();
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get collector listings', error);
    return [];
  }
}

async function getSingleListing(listingId?: string, chainId?: number) {
  if (!listingId) return [];
  try {
    const cid =
      typeof chainId === "number" && Number.isFinite(chainId) ? chainId : undefined;
    const listing = await getAuctionServer(listingId, cid != null ? { chainId: cid } : undefined);
    return listing ? [listing] : [];
  } catch (error) {
    console.error('[Homepage] Failed to get listing by id', error);
    return [];
  }
}

async function getFeaturedCarouselListings(): Promise<EnrichedAuctionData[]> {
  try {
    const db = getDatabase();
    const hiddenAddresses = await getHiddenUserAddresses();
    const rows = await db.select().from(featuredListings).orderBy(asc(featuredListings.displayOrder));
    if (rows.length === 0) return [];

    const resolved = await Promise.all(
      rows.map(async (f) => {
        const cid =
          typeof f.chainId === "number" && Number.isFinite(f.chainId) ? f.chainId : BASE_CHAIN_ID;
        try {
          const listing = await getAuctionServer(f.listingId, { chainId: cid });
          if (!listing) return null;
          if (isListingBlockedFromProduct(listing, hiddenAddresses)) return null;
          if (listing.status === "CANCELLED" || listing.status === "FINALIZED") return null;
          const totalAvailable = parseInt(String(listing.totalAvailable || "0"), 10);
          const totalSold = parseInt(String(listing.totalSold || "0"), 10);
          if (totalAvailable > 0 && totalSold >= totalAvailable) return null;
          return listing;
        } catch {
          return null;
        }
      })
    );

    return resolved.filter(Boolean) as EnrichedAuctionData[];
  } catch (e) {
    console.error("[Homepage] Failed to load featured carousel", e);
    return [];
  }
}

/** Optional `chainId` on featured section item metadata (listing rows) to disambiguate L1 vs Base. */
function chainIdFromFeaturedItemMetadata(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const raw = (metadata as Record<string, unknown>).chainId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
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
        const metaChain =
          item.itemType === "listing" ? chainIdFromFeaturedItemMetadata(item.metadata) : undefined;
        const listing = await getAuctionServer(
          item.itemId,
          metaChain != null ? { chainId: metaChain } : undefined
        );
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

async function getRecentListings(limit: number): Promise<EnrichedAuctionData[]> {
  try {
    // Get the most recent active listings ordered by creation date
    const { listings } = await browseListings({
      first: limit,
      skip: 0,
      orderBy: 'createdAt',
      orderDirection: 'desc',
      enrich: true,
    });
    
    const hiddenAddresses = await getHiddenUserAddresses();
    
    return listings
      .filter((listing) => {
        if (isListingBlockedFromProduct(listing, hiddenAddresses)) {
          return false;
        }
        if (listing.status === 'CANCELLED') {
          return false;
        }
        
        return true;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[Homepage] Failed to get recent listings', error);
    return [];
  }
}

export interface Tier1ListingCard {
  listingId: string;
  tokenId?: string;
  seller?: string | null;
  title: string;
  artist: string;
  description: string;
  image: string | null;
  thumbnailUrl: string | null;
}

export interface RedesignTieredSections {
  featured: {
    hero: Tier1ListingCard | null;
    artworks: Tier1ListingCard[];
  };
  kismetLots: Tier1ListingCard[];
  /** When set, homepage Kismet strip uses these full rows (same order as `kismetLots`). */
  kismetFullListings?: EnrichedAuctionData[];
}

/** Default featured gallery for redesign hero strip. Override with `HOMEPAGE_FEATURED_GALLERY_ID`. */
const DEFAULT_HOMEPAGE_FEATURED_GALLERY_ID = 'c3a947fa-da84-480e-a702-add1cfdeb8f7';
const HOMEPAGE_FEATURED_GALLERY_MAX_LOTS = 12;

const REDESIGN_TIER1_LIMIT = 12;
/**
 * Wall-clock budget for gallery + browse tier-1 (runs in parallel). Must stay under the
 * `/api/redesign/sections` route `maxDuration` (60s). Previously 18s caused empty fallbacks
 * whenever subgraph + metadata enrichment ran long.
 */
const REDESIGN_TIER1_TIMEOUT_MS = 55_000;
/** Per-lot subgraph+metadata cap so one slow listing does not burn the whole budget. */
const REDESIGN_GALLERY_PER_LISTING_MS = 9_000;
const REDESIGN_FALLBACK_DESCRIPTION =
  "Curated listing preview. Open the listing for live auction activity.";

/** Matches public URL `/user/kismet/gallery/kismet-casa-rome-auction` when the legacy UUID is absent. */
const DEFAULT_FEATURED_GALLERY_SLUG = "kismet-casa-rome-auction";
const DEFAULT_FEATURED_CURATOR_USERNAME = "kismet";

/**
 * Resolve which gallery powers the redesign strip: explicit UUID env, slug env, DB default UUID row, then slug fallback.
 */
async function resolveFeaturedGalleryUuidForHomepage(): Promise<string> {
  const explicitId = process.env.HOMEPAGE_FEATURED_GALLERY_ID?.trim();
  if (explicitId) return explicitId;

  const slugEnv = process.env.HOMEPAGE_FEATURED_GALLERY_SLUG?.trim();
  const curatorAddrEnv = process.env.HOMEPAGE_FEATURED_CURATOR_ADDRESS?.trim().toLowerCase();
  const curatorUserEnv = process.env.HOMEPAGE_FEATURED_CURATOR_USERNAME?.trim();

  const findPublishedBySlug = async (
    slug: string,
    curatorAddr: string | undefined,
    curatorUsername: string | undefined,
  ): Promise<string | null> => {
    let addr = curatorAddr;
    if (!addr && curatorUsername) {
      const nu = await lookupNeynarByUsername(curatorUsername);
      addr = nu?.address?.toLowerCase() ?? undefined;
    }
    if (!slug || !addr) return null;
    const db = getDatabase();
    const addrLower = addr.toLowerCase();
    const [g] = await db
      .select({ id: curation.id })
      .from(curation)
      .where(
        and(
          eq(curation.slug, slug),
          sql`lower(${curation.curatorAddress}) = ${addrLower}`,
          eq(curation.isPublished, true)
        )
      )
      .limit(1);
    return g?.id ?? null;
  };

  if (slugEnv) {
    const id = await findPublishedBySlug(slugEnv, curatorAddrEnv, curatorUserEnv);
    if (id) return id;
  }

  const db = getDatabase();
  const [uuidRow] = await db
    .select({ id: curation.id })
    .from(curation)
    .where(eq(curation.id, DEFAULT_HOMEPAGE_FEATURED_GALLERY_ID))
    .limit(1);
  if (uuidRow) return DEFAULT_HOMEPAGE_FEATURED_GALLERY_ID;

  const slugFallback = await findPublishedBySlug(
    DEFAULT_FEATURED_GALLERY_SLUG,
    undefined,
    DEFAULT_FEATURED_CURATOR_USERNAME,
  );
  if (slugFallback) {
    console.log(
      `[RedesignTier1] Featured gallery UUID not in DB; using slug ${DEFAULT_FEATURED_CURATOR_USERNAME}/${DEFAULT_FEATURED_GALLERY_SLUG} -> ${slugFallback}`
    );
    return slugFallback;
  }

  return DEFAULT_HOMEPAGE_FEATURED_GALLERY_ID;
}

/**
 * When subgraph `getAuctionServer` misses (indexing lag, hidden filter, etc.) but we have a
 * `listing_media_preview` row, still surface the lot on the homepage strip.
 */
function minimalEnrichedFromListingPreview(
  listingId: string,
  preview: {
    tokenAddress: string;
    tokenId: string;
    title?: string | null;
    imageUrl?: string | null;
    thumbnailSmallUrl?: string | null;
  },
): EnrichedAuctionData {
  const now = String(Math.floor(Date.now() / 1000));
  return {
    id: listingId,
    listingId,
    chainId: 8453,
    marketplace: "0x0000000000000000000000000000000000000000",
    seller: "0x0000000000000000000000000000000000000000",
    tokenAddress: preview.tokenAddress,
    tokenId: String(preview.tokenId),
    tokenSpec: "ERC721",
    listingType: "INDIVIDUAL_AUCTION",
    initialAmount: "0",
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "0",
    endTime: "0",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: "0",
    createdAt: now,
    createdAtBlock: "0",
    bidCount: 0,
    title: preview.title ?? `Listing #${listingId}`,
    image: preview.imageUrl ?? undefined,
    thumbnailUrl: preview.thumbnailSmallUrl ?? preview.imageUrl ?? undefined,
    description: REDESIGN_FALLBACK_DESCRIPTION,
  };
}

async function getPublishedGalleryListingsEnriched(
  galleryId: string
): Promise<EnrichedAuctionData[]> {
  const id = galleryId.trim();
  if (!id) return [];
  try {
    const db = getDatabase();
    const [gallery] = await db.select().from(curation).where(eq(curation.id, id)).limit(1);
    if (!gallery) {
      console.warn(`[RedesignTier1] Gallery row not found for id=${id}`);
      return [];
    }
    if (!gallery.isPublished) {
      console.warn(
        `[RedesignTier1] Gallery ${id} exists but is_published=false — homepage strip will not use it`
      );
      return [];
    }
    const items = await db
      .select()
      .from(curationItems)
      .where(eq(curationItems.curationId, id))
      .orderBy(asc(curationItems.displayOrder));
    if (items.length === 0) {
      console.warn(`[RedesignTier1] Gallery ${id} has zero curation_items`);
      return [];
    }

    const slice = items.slice(0, HOMEPAGE_FEATURED_GALLERY_MAX_LOTS);
    const listingIds = slice.map((it) => String(it.listingId));
    const previews = await getListingPreviewsByIds(listingIds);

    const rows: (EnrichedAuctionData | null)[] = await Promise.all(
      slice.map(async (item) => {
        const lid = String(item.listingId);
        const full = await Promise.race([
          getAuctionServer(lid),
          new Promise<EnrichedAuctionData | null>((resolve) =>
            setTimeout(() => resolve(null), REDESIGN_GALLERY_PER_LISTING_MS)
          ),
        ]);
        if (full) return full;
        const p = previews.get(lid);
        if (p?.tokenAddress) {
          console.warn(
            `[RedesignTier1] getAuctionServer returned null for listingId=${lid}; using listing_media_preview fallback`
          );
          return minimalEnrichedFromListingPreview(lid, p);
        }
        console.warn(`[RedesignTier1] No subgraph row and no preview for listingId=${lid}`);
        return null;
      })
    );

    const out = rows.filter((r): r is EnrichedAuctionData => r != null);
    console.log(
      `[RedesignTier1] Gallery ${id}: ${items.length} items in DB, ${out.length} resolved for homepage`
    );
    return out;
  } catch (e) {
    console.error('[RedesignTier1] Failed to load featured gallery listings', e);
    return [];
  }
}

const ZERO_EXCLUDED_SELLER = "0x0000000000000000000000000000000000000000";

function shortHexAddress(addr: string | null | undefined): string | null {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.trim().toLowerCase();
  if (!a.startsWith("0x") || a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function hasNonZeroSeller(seller: string | null | undefined): seller is string {
  if (!seller || typeof seller !== "string") return false;
  return seller.trim().toLowerCase() !== ZERO_EXCLUDED_SELLER;
}

/** Homepage "by …" line: marketplace lister (seller), not NFT metadata artist (often gallery branding). */
async function resolveListingSellerDisplayLabel(
  seller: string | null | undefined,
): Promise<string | null> {
  if (!hasNonZeroSeller(seller)) return null;
  const neynar = await lookupNeynarByAddress(seller.trim());
  const name = neynar?.name?.trim();
  return name && name.length > 0 ? name : null;
}

/** Many token JSON files use this as a default; treat as missing so fallbacks apply. */
function isJunkDisplayArtist(value: string | null | undefined): boolean {
  if (value == null || typeof value !== "string") return true;
  const v = value.trim().toLowerCase();
  return (
    v === "" ||
    v === "unknown artist" ||
    v === "unknown" ||
    v === "n/a" ||
    v === "null" ||
    v === "anonymous"
  );
}

let lastKnownRedesignSections: RedesignTieredSections | null = null;

async function toTier1Card(listing: EnrichedAuctionData): Promise<Tier1ListingCard> {
  primeListingMediaSnapshot(listing);
  const snapshot = getListingMediaSnapshot(listing.listingId);
  const title =
    snapshot?.title || listing.title || `Listing #${listing.listingId}`;
  const rawMetaArtist = snapshot?.artist || listing.artist;
  const sellerLabel = await resolveListingSellerDisplayLabel(listing.seller);

  let artist: string;
  if (sellerLabel) {
    artist = sellerLabel;
  } else if (hasNonZeroSeller(listing.seller)) {
    artist = shortHexAddress(listing.seller) || "—";
  } else if (!isJunkDisplayArtist(rawMetaArtist)) {
    artist = rawMetaArtist!.trim();
  } else {
    artist = "—";
  }

  return {
    listingId: listing.listingId,
    tokenId: listing.tokenId,
    seller: listing.seller ?? null,
    title,
    artist,
    description:
      snapshot?.description ||
      listing.description ||
      REDESIGN_FALLBACK_DESCRIPTION,
    image: snapshot?.image || listing.image || null,
    thumbnailUrl: snapshot?.thumbnailUrl || listing.thumbnailUrl || listing.image || null,
  };
}

async function resolveRedesignTieredSectionsUncached(): Promise<RedesignTieredSections> {
  const featuredGalleryId = await resolveFeaturedGalleryUuidForHomepage();

  const [galleryListings, browseResult] = await Promise.all([
    getPublishedGalleryListingsEnriched(featuredGalleryId),
    browseListings({
      first: REDESIGN_TIER1_LIMIT,
      skip: 0,
      orderBy: "createdAt",
      orderDirection: "desc",
      enrich: true,
    }),
  ]);

  const { listings } = browseResult;
  const tier1Listings = await Promise.all(
    listings
      .filter((listing) => listing.status !== "CANCELLED")
      .map((listing) => toTier1Card(listing)),
  );

  if (tier1Listings.length === 0) {
    console.warn("[RedesignTier1] Browse returned no tier-1 listings", {
      subgraphDown: browseResult.subgraphDown,
      rawCount: listings.length,
    });
  }

  const hero = tier1Listings[0] || null;
  const artworks = tier1Listings.slice(0, 4);

  let kismetLots: Tier1ListingCard[];
  let kismetFullListings: EnrichedAuctionData[] | undefined;
  if (galleryListings.length > 0) {
    kismetLots = await Promise.all(galleryListings.map((l) => toTier1Card(l)));
    kismetFullListings = galleryListings;
  } else {
    kismetLots = tier1Listings.slice(0, 8);
    kismetFullListings = undefined;
  }

  if (kismetLots.length === 0 && tier1Listings.length === 0) {
    console.warn("[RedesignTier1] Both gallery strip and browse tier-1 are empty", {
      featuredGalleryId,
    });
  }

  const resolved = {
    featured: { hero, artworks },
    kismetLots,
    kismetFullListings,
  };
  lastKnownRedesignSections = resolved;
  return resolved;
}

async function resolveRedesignTieredSectionsWithBudget(): Promise<RedesignTieredSections> {
  const fallback =
    lastKnownRedesignSections ??
    ({
      featured: { hero: null, artworks: [] },
      kismetLots: [],
      kismetFullListings: undefined,
    } satisfies RedesignTieredSections);

  const startedAt = Date.now();
  const result = await withTimeout(
    resolveRedesignTieredSectionsUncached(),
    REDESIGN_TIER1_TIMEOUT_MS,
    fallback
  );
  const elapsed = Date.now() - startedAt;
  console.log(
    `[RedesignTier1] sections resolved in ${elapsed}ms${result === fallback ? " (fallback)" : ""}`
  );
  return result;
}

export const getRedesignTieredSections = unstable_cache(
  async () => resolveRedesignTieredSectionsWithBudget(),
  ["redesign-tiered-sections-v7-tier1-seller-display"],
  {
    revalidate: 120,
    tags: ["redesign-tiered-sections"],
  }
);

