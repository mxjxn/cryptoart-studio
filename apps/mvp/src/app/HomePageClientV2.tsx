"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { formatEther } from "viem";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { EnrichedAuctionData } from "~/lib/types";
import { usePretextMeasure } from "~/hooks/usePretextMeasure";


// Helper function to check if a listing is ERC721
function isERC721(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC721" || String(tokenSpec) === "1";
}

// Helper function to check if a listing is ERC1155
function isERC1155(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC1155" || String(tokenSpec) === "2";
}

const FARCON_STATIC_PREVIEW = true;
const TIER1_TIMEOUT_MS = 2500;
const TIER2_TIMEOUT_MS = 3000;

const KISMET_GRADIENTS = [
  "linear-gradient(135deg, #f5acd1 0%, #dcf54c 52%, #ecc100 100%)",
  "linear-gradient(135deg, #ff0402 0%, #f5acd1 45%, #272727 100%)",
  "linear-gradient(135deg, #dcf54c 0%, #ffffff 48%, #f5acd1 100%)",
  "linear-gradient(135deg, #ecc100 0%, #ff0402 55%, #000000 100%)",
  "linear-gradient(135deg, #272727 0%, #dcf54c 50%, #ffffff 100%)",
  "linear-gradient(135deg, #f5acd1 0%, #ff0402 42%, #ecc100 100%)",
  "linear-gradient(135deg, #ffffff 0%, #ecc100 50%, #272727 100%)",
  "linear-gradient(135deg, #dcf54c 0%, #f5acd1 55%, #ff0402 100%)",
];

const KISMET_CASA_PLACEHOLDERS: EnrichedAuctionData[] = Array.from({ length: 8 }, (_, index) => {
  const n = index + 1;
  const amount = BigInt(n + 1) * 1000000000000000n;
  const listingType = index % 3 === 0 ? "INDIVIDUAL_AUCTION" : "FIXED_PRICE";
  return {
    id: `kismet-placeholder-${n}`,
    listingId: `kismet-placeholder-${n}`,
    marketplace: "0x0000000000000000000000000000000000000000",
    seller: "0x1111111111111111111111111111111111111111",
    tokenAddress: "0x2222222222222222222222222222222222222222",
    tokenId: String(n),
    tokenSpec: "ERC721",
    listingType,
    initialAmount: amount.toString(),
    totalAvailable: "1",
    totalPerSale: "1",
    startTime: "0",
    endTime: "0",
    lazy: false,
    status: "ACTIVE",
    finalized: false,
    totalSold: "0",
    currentPrice: amount.toString(),
    createdAt: String(1777460000 + n),
    createdAtBlock: String(30000000 + n),
    bidCount: listingType === "INDIVIDUAL_AUCTION" ? n : 0,
    highestBid: listingType === "INDIVIDUAL_AUCTION"
      ? {
          amount: amount.toString(),
          bidder: `0x${String(n).repeat(40).slice(0, 40)}`,
          timestamp: String(1777460000 + n),
        }
      : undefined,
    title: `Kismet Casa Lot ${n}`,
    artist: "Kismet Casa",
    description: "Placeholder auction item for the FarCon live bidding preview.",
  };
});

type Tier1ListingCard = {
  listingId: string;
  tokenId?: string;
  title: string;
  artist: string;
  description: string;
  image: string | null;
  thumbnailUrl: string | null;
};

type Tier2HydrationItem = {
  listingId: string;
  currentPrice: string;
  listingType: string;
  status: string;
  bidCount: number;
};

function shouldSkipDynamicRedesignFetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const effectiveType = nav.connection?.effectiveType ?? "";
  const saveData = nav.connection?.saveData ?? false;
  return saveData || effectiveType.includes("2g") || effectiveType.includes("3g");
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Preview homepage matching Figma "Homepage" (Screens); served at /redesign */
export default function HomePageClientV2() {
  const [featuredHero, setFeaturedHero] = useState<Tier1ListingCard | null>(null);
  const [featuredArtworks, setFeaturedArtworks] = useState<Tier1ListingCard[]>([]);
  const [kismetTier1Lots, setKismetTier1Lots] = useState<Tier1ListingCard[]>(
    KISMET_CASA_PLACEHOLDERS.map((auction) => ({
      listingId: auction.listingId,
      tokenId: auction.tokenId,
      title: auction.title || `Kismet Casa Lot ${auction.tokenId}`,
      artist: auction.artist || "Kismet Casa",
      description:
        auction.description ||
        "Limited lot preview. Open listing for full details and bidding controls.",
      image: auction.image || null,
      thumbnailUrl: auction.thumbnailUrl || auction.image || null,
    }))
  );
  const [kismetHydratedLots, setKismetHydratedLots] = useState<Record<string, Tier2HydrationItem>>({});
  const [kismetHydrationDone, setKismetHydrationDone] = useState(false);
  // Recent NFTs (ERC721) state
  const [nftListings, setNftListings] = useState<EnrichedAuctionData[]>(
    FARCON_STATIC_PREVIEW ? KISMET_CASA_PLACEHOLDERS : [],
  );
  const [nftExpandedListings, setNftExpandedListings] = useState<EnrichedAuctionData[]>([]);
  const [nftLoading, setNftLoading] = useState(!FARCON_STATIC_PREVIEW);
  const [nftLoadingMore, setNftLoadingMore] = useState(false);
  const [nftError, setNftError] = useState<string | null>(null);
  const [nftSubgraphDown, setNftSubgraphDown] = useState(false);
  const [nftHasMore, setNftHasMore] = useState(!FARCON_STATIC_PREVIEW);
  const nftLoadingRef = useRef(true);
  const nftHasInitializedRef = useRef(false);
  const nftExpandedRef = useRef(FARCON_STATIC_PREVIEW);

  // Recent Editions (ERC1155) state
  const [editionListings, setEditionListings] = useState<EnrichedAuctionData[]>(
    FARCON_STATIC_PREVIEW ? KISMET_CASA_PLACEHOLDERS.slice(0, 4) : [],
  );
  const [editionExpandedListings, setEditionExpandedListings] = useState<EnrichedAuctionData[]>([]);
  const [editionLoading, setEditionLoading] = useState(!FARCON_STATIC_PREVIEW);
  const [editionLoadingMore, setEditionLoadingMore] = useState(false);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [editionSubgraphDown, setEditionSubgraphDown] = useState(false);
  const [editionHasMore, setEditionHasMore] = useState(!FARCON_STATIC_PREVIEW);
  const editionLoadingRef = useRef(true);
  const editionHasInitializedRef = useRef(false);
  const editionExpandedRef = useRef(FARCON_STATIC_PREVIEW);

  // Loading modal state for listing navigation
  const [loadingListing, setLoadingListing] = useState<{
    listingId: string;
    image: string | null;
    title: string;
  } | null>(null);

  const pageSize = 4; // Show 4 listings per section on homepage
  const displayCount = 4; // Display exactly 4 items initially
  const initialFetchCount = 20; // Fetch 20 initially to account for filtering
  const loadMoreCount = 20; // Load 20 more items when expanding

  // Load more NFTs inline
  const loadMoreNFTs = useCallback(async () => {
    if (nftLoadingMore || !nftHasMore || nftExpandedRef.current) return;
    
    setNftLoadingMore(true);
    nftExpandedRef.current = true;
    
    try {
      // Skip the initial fetch count since we fetched that many listings initially
      // This ensures we don't get duplicates when filtering client-side
      const skip = initialFetchCount;
      const response = await fetch(`/api/listings/browse?first=${loadMoreCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response (same logic as fetchRecentNFTs)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11;
          }
        }
        
        if (listingsArrayStart !== -1) {
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
                      setNftExpandedListings(nftListings);
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                break;
              }
            }
          }
        }
      }
      
      // Final parse attempt
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
          setNftExpandedListings(nftListings);
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const nftListings = listings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      setNftExpandedListings(nftListings);
      
      // Check if we have more to load
      if (nftListings.length < loadMoreCount) {
        setNftHasMore(false);
      }
    } catch (error) {
      console.error('[HomePageClientV2] Error loading more NFTs:', error);
    } finally {
      setNftLoadingMore(false);
    }
  }, [initialFetchCount, loadMoreCount, nftHasMore, nftLoadingMore]);

  // Load more Editions inline
  const loadMoreEditions = useCallback(async () => {
    if (editionLoadingMore || !editionHasMore || editionExpandedRef.current) return;
    
    setEditionLoadingMore(true);
    editionExpandedRef.current = true;
    
    try {
      // Skip the initial fetch count since we fetched that many listings initially
      // This ensures we don't get duplicates when filtering client-side
      const skip = initialFetchCount;
      const response = await fetch(`/api/listings/browse?first=${loadMoreCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response (same logic as fetchRecentEditions)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11;
          }
        }
        
        if (listingsArrayStart !== -1) {
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
                      setEditionExpandedListings(editionListings);
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                break;
              }
            }
          }
        }
      }
      
      // Final parse attempt
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
          setEditionExpandedListings(editionListings);
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const editionListings = listings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      setEditionExpandedListings(editionListings);
      
      // Check if we have more to load
      if (editionListings.length < loadMoreCount) {
        setEditionHasMore(false);
      }
    } catch (error) {
      console.error('[HomePageClientV2] Error loading more Editions:', error);
    } finally {
      setEditionLoadingMore(false);
    }
  }, [initialFetchCount, loadMoreCount, editionHasMore, editionLoadingMore]);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { address, isConnected } = useEffectiveAddress();
  const ensName = useEnsNameForAddress(address, !isMiniApp && isConnected && !!address);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pretextDebugEnabled = process.env.NODE_ENV !== "production" && searchParams.get("pretextDebug") === "1";

  // Hide loading modal when route changes away from homepage (navigation completes)
  useEffect(() => {
    if (loadingListing) {
      // If we're no longer on the homepage, hide the modal
      // pathname will be /listing/[id] when navigation completes
      if (pathname && pathname !== '/' && pathname.startsWith('/listing/')) {
        // Small delay to allow page transition to complete
        const timer = setTimeout(() => {
          setLoadingListing(null);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        // Fallback: hide modal after 5 seconds if navigation doesn't happen
        const fallbackTimer = setTimeout(() => {
          setLoadingListing(null);
        }, 5000);
        return () => clearTimeout(fallbackTimer);
      }
    }
  }, [pathname, loadingListing]);
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;

  // Fetch recent NFTs (ERC721) - homepage only shows 6
  const fetchRecentNFTs = useCallback(async () => {
    setNftLoading(true);
    nftLoadingRef.current = true;
    setNftError(null);
    try {
      // Fetch more than needed to account for filtering
      console.log('[HomePageClientV2] Fetching recent NFTs...', { fetchCount: initialFetchCount });
      const startTime = Date.now();
      
      // Use streaming mode for incremental loading
      const response = await fetch(`/api/listings/browse?first=${initialFetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response
      // The stream sends: {"success":true,"listings":[listing1,listing2,...],"count":...,...}
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let metadata: { subgraphDown?: boolean; degraded?: boolean; count?: number } = {};
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Find the start of the listings array
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11; // Length of '"listings":[' 
          }
        }
        
        if (listingsArrayStart !== -1) {
          // Parse complete listing objects from the buffer
          // Look for complete JSON objects (balanced braces, accounting for strings)
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  // Found a complete listing object
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      // Filter for ERC721 and update state incrementally
                      const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
                      if (nftListings.length > 0) {
                        setNftListings(nftListings.slice(0, displayCount));
                      }
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                // End of listings array - try to parse final metadata
                const afterArray = buffer.substring(listingsArrayStart + i);
                try {
                  const metaMatch = afterArray.match(/"count":(\d+)/);
                  if (metaMatch) metadata.count = parseInt(metaMatch[1]);
                  const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
                  if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === 'true';
                  const degradedMatch = afterArray.match(/"degraded":(true|false)/);
                  if (degradedMatch) metadata.degraded = degradedMatch[1] === 'true';
                } catch {
                  // Continue
                }
                break;
              }
            }
          }
          
          // Keep the unprocessed part of the buffer (incomplete JSON objects)
          if (startIdx !== -1 && startIdx < listingsPart.length) {
            buffer = buffer.substring(0, listingsArrayStart + startIdx);
          } else {
            // Remove processed listings from buffer
            const lastProcessedIdx = listingsPart.lastIndexOf('}');
            if (lastProcessedIdx !== -1) {
              buffer = buffer.substring(0, listingsArrayStart + lastProcessedIdx + 1);
            }
          }
        }
      }
      
      // Final parse attempt for any remaining complete data
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const nftListings = listings.filter((l: EnrichedAuctionData) => isERC721(l.tokenSpec));
          setNftListings(nftListings.slice(0, displayCount));
        }
        if (finalData.subgraphDown !== undefined) {
          metadata.subgraphDown = finalData.subgraphDown;
        }
        if (finalData.degraded !== undefined) {
          metadata.degraded = finalData.degraded;
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClientV2] NFT fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC721 only
      const nftListings = listings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || metadata.degraded || false;
      console.log('[HomePageClientV2] Received NFTs:', nftListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setNftListings(nftListings.slice(0, displayCount));
      setNftSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
      console.error('[HomePageClientV2] Error fetching NFTs:', errorMessage, error);
      setNftError(errorMessage);
    } finally {
      setNftLoading(false);
      nftLoadingRef.current = false;
    }
  }, [displayCount, initialFetchCount]);

  // Fetch recent Editions (ERC1155) - homepage only shows 6
  const fetchRecentEditions = useCallback(async () => {
    setEditionLoading(true);
    editionLoadingRef.current = true;
    setEditionError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC1155 after filtering
      console.log('[HomePageClientV2] Fetching recent Editions...', { fetchCount });
      const startTime = Date.now();
      
      // Use streaming mode for incremental loading
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true&stream=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Parse streaming JSON response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let listings: EnrichedAuctionData[] = [];
      let metadata: { subgraphDown?: boolean; degraded?: boolean; count?: number } = {};
      let listingsArrayStart = -1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Find the start of the listings array
        if (listingsArrayStart === -1) {
          const arrayStart = buffer.indexOf('"listings":[');
          if (arrayStart !== -1) {
            listingsArrayStart = arrayStart + 11; // Length of '"listings":[' 
          }
        }
        
        if (listingsArrayStart !== -1) {
          // Parse complete listing objects from the buffer
          // Look for complete JSON objects (balanced braces, accounting for strings)
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let startIdx = -1;
          const listingsPart = buffer.substring(listingsArrayStart);
          
          for (let i = 0; i < listingsPart.length; i++) {
            const char = listingsPart[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                  // Found a complete listing object
                  try {
                    const listingJson = listingsPart.substring(startIdx, i + 1);
                    const listing = JSON.parse(listingJson);
                    if (listing.listingId && !listings.find(l => l.listingId === listing.listingId)) {
                      listings.push(listing);
                      // Filter for ERC1155 and update state incrementally
                      const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
                      if (editionListings.length > 0) {
                        setEditionListings(editionListings.slice(0, displayCount));
                      }
                    }
                  } catch (e) {
                    // Partial JSON, will be completed in next chunk
                  }
                  startIdx = -1;
                }
              } else if (char === ']' && braceCount === 0) {
                // End of listings array - try to parse final metadata
                const afterArray = buffer.substring(listingsArrayStart + i);
                try {
                  const metaMatch = afterArray.match(/"count":(\d+)/);
                  if (metaMatch) metadata.count = parseInt(metaMatch[1]);
                  const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
                  if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === 'true';
                  const degradedMatch = afterArray.match(/"degraded":(true|false)/);
                  if (degradedMatch) metadata.degraded = degradedMatch[1] === 'true';
                } catch {
                  // Continue
                }
                break;
              }
            }
          }
          
          // Keep the unprocessed part of the buffer (incomplete JSON objects)
          if (startIdx !== -1 && startIdx < listingsPart.length) {
            buffer = buffer.substring(0, listingsArrayStart + startIdx);
          } else {
            // Remove processed listings from buffer
            const lastProcessedIdx = listingsPart.lastIndexOf('}');
            if (lastProcessedIdx !== -1) {
              buffer = buffer.substring(0, listingsArrayStart + lastProcessedIdx + 1);
            }
          }
        }
      }
      
      // Final parse attempt for any remaining complete data
      try {
        const finalData = JSON.parse(buffer);
        if (finalData.listings && Array.isArray(finalData.listings)) {
          listings = finalData.listings;
          const editionListings = listings.filter((l: EnrichedAuctionData) => isERC1155(l.tokenSpec));
          setEditionListings(editionListings.slice(0, displayCount));
        }
        if (finalData.subgraphDown !== undefined) {
          metadata.subgraphDown = finalData.subgraphDown;
        }
        if (finalData.degraded !== undefined) {
          metadata.degraded = finalData.degraded;
        }
      } catch {
        // Buffer might be incomplete, that's okay
      }
      
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClientV2] Edition fetch completed in', fetchTime, 'ms');
      
      // Filter for ERC1155 only
      const editionListings = listings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      const isSubgraphDown = metadata.subgraphDown || metadata.degraded || false;
      console.log('[HomePageClientV2] Received Editions:', editionListings.length, 'from', listings.length, 'total listings');
      
      // Take only displayCount for display
      setEditionListings(editionListings.slice(0, displayCount));
      setEditionSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Editions';
      console.error('[HomePageClientV2] Error fetching Editions:', errorMessage, error);
      setEditionError(errorMessage);
    } finally {
      setEditionLoading(false);
      editionLoadingRef.current = false;
    }
  }, [displayCount, initialFetchCount]);

  // Initialize NFTs section
  useEffect(() => {
    if (FARCON_STATIC_PREVIEW) return;
    if (nftHasInitializedRef.current) return;
    nftHasInitializedRef.current = true;
    fetchRecentNFTs();
    
    // Refetch when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentNFTs();
      }
    };
    
    // Refetch on window focus (user switches back to window)
    const handleFocus = () => {
      fetchRecentNFTs();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRecentNFTs]);

  // Initialize Editions section
  useEffect(() => {
    if (FARCON_STATIC_PREVIEW) return;
    if (editionHasInitializedRef.current) return;
    editionHasInitializedRef.current = true;
    fetchRecentEditions();
    
    // Refetch when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentEditions();
      }
    };
    
    // Refetch on window focus (user switches back to window)
    const handleFocus = () => {
      fetchRecentEditions();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRecentEditions]);

  const displayHandle = isMiniApp
    ? context?.user?.username
      ? `@${context.user.username}`
      : context?.user?.displayName ?? "Guest"
    : !isConnected || !address
      ? "Connect wallet"
      : ensName
        ? `@${ensName.replace(/^@/, "")}`
        : `@${address.slice(0, 6)}…${address.slice(-4)}`;

  const formatListingEth = (a: EnrichedAuctionData) => {
    try {
      const v = a.currentPrice || a.initialAmount || "0";
      return `${formatEther(BigInt(v))} ETH`;
    } catch {
      return "— ETH";
    }
  };

  const formatBidder = (bidder: string | undefined) => {
    if (!bidder) return "Unknown bidder";
    return `${bidder.slice(0, 6)}…${bidder.slice(-4)}`;
  };

  const bidTimestamp = (a: EnrichedAuctionData) => {
    try {
      return BigInt(a.highestBid?.timestamp ?? "0");
    } catch {
      return 0n;
    }
  };

  const bidListings = [...nftListings, ...editionListings]
    .filter((auction) => auction.highestBid?.amount)
    .sort((a, b) => {
      const bt = bidTimestamp(b);
      const at = bidTimestamp(a);
      if (bt === at) return 0;
      return bt > at ? 1 : -1;
    })
    .slice(0, 4);
  const gutter = "px-3 sm:px-5 md:px-8 lg:px-12 xl:px-16";

  useEffect(() => {
    let cancelled = false;

    const loadTier1 = async () => {
      const startedAt = performance.now();
      if (shouldSkipDynamicRedesignFetch()) {
        console.log("[HomePageClientV2] Skipping tier1 dynamic fetch on constrained network");
        return;
      }
      try {
        const data = await fetchJsonWithTimeout("/api/redesign/sections", TIER1_TIMEOUT_MS);
        if (!data?.success || !data?.sections || cancelled) return;

        setFeaturedHero(data.sections.featured?.hero ?? null);
        setFeaturedArtworks(data.sections.featured?.artworks ?? []);

        if (Array.isArray(data.sections.kismetLots) && data.sections.kismetLots.length > 0) {
          setKismetTier1Lots(data.sections.kismetLots);
        }
        console.log(
          `[HomePageClientV2] Tier1 loaded in ${Math.round(performance.now() - startedAt)}ms`
        );
      } catch (error) {
        console.warn("[HomePageClientV2] Tier1 fetch timed out or failed, keeping curated fallback:", error);
      }
    };

    void loadTier1();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKismetHydrationDone(false);

    const loadTier2 = async () => {
      const startedAt = performance.now();
      if (shouldSkipDynamicRedesignFetch()) {
        console.log("[HomePageClientV2] Skipping tier2 hydration on constrained network");
        if (!cancelled) setKismetHydrationDone(true);
        return;
      }
      try {
        const ids = kismetTier1Lots.map((lot) => lot.listingId).join(",");
        const data = await fetchJsonWithTimeout(
          `/api/redesign/hydration?ids=${encodeURIComponent(ids)}`,
          TIER2_TIMEOUT_MS
        );

        if (cancelled) return;
        const hydrated = (data?.items || {}) as Record<string, Tier2HydrationItem>;
        setKismetHydratedLots(hydrated);
        console.log(
          `[HomePageClientV2] Tier2 hydration loaded in ${Math.round(performance.now() - startedAt)}ms`
        );
      } catch (error) {
        console.warn("[HomePageClientV2] Tier2 hydration timed out or failed, keeping placeholder pricing:", error);
      } finally {
        if (!cancelled) setKismetHydrationDone(true);
      }
    };

    void loadTier2();

    return () => {
      cancelled = true;
    };
  }, [kismetTier1Lots]);

  const showDataDegradedNotice = nftSubgraphDown || editionSubgraphDown || !!nftError || !!editionError;
  const heroListingId = featuredHero?.listingId || kismetTier1Lots[0]?.listingId;
  const heroTaglineText =
    "CryptoArt is an auction marketplace for digital art, centered on human curation. Create galleries to surface what matters.";
  const heroDescriptionText =
    featuredHero?.description ||
    "Placeholder event gallery. Replace this copy with the real room, artist, and bidding instructions before launch.";
  const lotIntroText = "Individual lot previews. Click into a listing to place bids.";

  const heroTaglineMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: heroTaglineText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });
  const heroDescriptionMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: heroDescriptionText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });
  const lotIntroMeasure = usePretextMeasure<HTMLParagraphElement>({
    text: lotIntroText,
    font: "400 14px MEK-Mono",
    lineHeightPx: 21,
  });

  return (
    <div className="min-h-screen bg-white text-black flex justify-center">
      <div className="flex w-full max-w-[402px] sm:max-w-[min(100%,720px)] md:max-w-[min(100%,900px)] lg:max-w-[min(100%,1100px)] xl:max-w-[min(100%,1280px)] flex-col min-h-screen border-x border-[#222] bg-white shadow-2xl">
      {/* Create Listing */}
      {isMember && (
        <section className="border-b border-[#333333]">
          <div className={`flex justify-center py-3 ${gutter}`}>
            <TransitionLink
              href="/create"
              prefetch={false}
              className="font-mek-mono text-sm tracking-[0.5px] text-[#999999] transition-colors hover:text-white"
            >
              + Create Listing
            </TransitionLink>
          </div>
        </section>
      )}

      {/* Figma: membership strip */}
      {!membershipLoading && (
        <button
          type="button"
          onClick={() => {
            router.push("/membership");
          }}
          className="flex w-full flex-wrap items-center justify-center gap-1 bg-[#f5b0d3] px-2 py-1 font-space-grotesk text-[11px] font-medium leading-none text-black sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs"
        >
          <span className="text-black">{isMember ? "Member" : "become a member"}</span>
          {!isMember && <span className="text-black">0.0001 ETH /MONTH</span>}
        </button>
      )}

      {showDataDegradedNotice && (
        <section className="w-full border-b border-[#333333] bg-[#221f12]">
          <div className={`py-2 font-mek-mono text-xs text-[#f6d87d] ${gutter}`}>
            Live listing data is temporarily degraded. You may see placeholders or delayed updates while services recover.
          </div>
        </section>
      )}

      {/* Figma: identity row */}
      <div className={`flex w-full items-center justify-between bg-black py-5 font-mek-mono text-sm text-white ${gutter}`}>
        <span className="min-w-0 truncate">{displayHandle}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#333333] text-white"
            aria-hidden="true"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
              <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-1 1a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.2 1.2 0 0 1-1.2 1.2h-1.4A1.2 1.2 0 0 1 10.4 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-1-1a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.2 1.2 0 0 1-1.2-1.2v-1.4A1.2 1.2 0 0 1 4 10.4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l1-1a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4A1.2 1.2 0 0 1 10.4 2.8h1.4A1.2 1.2 0 0 1 13 4v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l1 1a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1.2 1.2 0 0 1 1.2 1.2v1.4a1.2 1.2 0 0 1-1.2 1.2h-.2a1 1 0 0 0-.9.6Z" />
            </svg>
          </span>
          <ProfileDropdown />
        </div>
      </div>

      {/* Figma: hero / logo + tagline — stack on mobile, row on desktop */}
      <div className={`flex flex-col gap-4 bg-black pb-5 pt-5 md:flex-row md:items-center md:gap-8 md:pb-8 ${gutter}`}>
        <div className="relative aspect-[384/119] w-full md:w-1/2 md:max-w-xl md:shrink-0">
          <Image
            src="/cryptoart-logo-wgmeets.png"
            alt="CryptoArt"
            fill
            className="object-contain object-left md:object-center"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 576px"
            priority
          />
        </div>
        <div className="md:flex-1 md:py-0">
          <p ref={heroTaglineMeasure.ref} className="font-space-grotesk text-sm leading-normal text-white">
            {heroTaglineText}
          </p>
          <TransitionLink
            href="/market"
            prefetch={false}
            className="mt-4 inline-flex w-fit border border-white px-3 py-1.5 !font-space-grotesk text-xs tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black"
          >
            View all listings
          </TransitionLink>
        </div>
      </div>

      {pretextDebugEnabled && (
        <section className={`w-full border-y border-[#333333] bg-black py-3 font-space-grotesk text-xs text-[#f5b0d3] ${gutter}`}>
          <div className="grid gap-1 md:grid-cols-3">
            <p>
              heroTagline lines: actual {heroTaglineMeasure.actualLineCount} / predicted {heroTaglineMeasure.predicted.lineCount} (w{" "}
              {Math.round(heroTaglineMeasure.width)}px)
            </p>
            <p>
              heroDescription lines: actual {heroDescriptionMeasure.actualLineCount} / predicted{" "}
              {heroDescriptionMeasure.predicted.lineCount} (w {Math.round(heroDescriptionMeasure.width)}px)
            </p>
            <p>
              lotIntro lines: actual {lotIntroMeasure.actualLineCount} / predicted {lotIntroMeasure.predicted.lineCount} (w{" "}
              {Math.round(lotIntroMeasure.width)}px)
            </p>
          </div>
        </section>
      )}

      {/* Figma: Galleries (lime) */}
      <section className="w-full bg-[#dcf54c] text-[#272727]">
        <h2 className={`pt-5 font-space-grotesk text-[clamp(3.25rem,15vw,5.85rem)] font-medium leading-[0.9] text-[#999] ${gutter}`}>
          Featured
        </h2>
        <div className={`relative z-10 -mt-4 pb-6 md:-mt-[28px] ${gutter}`}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-stretch">
            <div className="relative min-h-[360px] overflow-hidden border border-black/15 bg-[#dcf54c] text-black">
              <div
                className="absolute inset-0"
                style={{ background: KISMET_GRADIENTS[0] }}
                aria-hidden
              />
              <div className="absolute inset-0 bg-white/25" aria-hidden />
              <div className="relative flex min-h-[360px] flex-col justify-between p-4 sm:p-6">
                <div className="font-space-grotesk text-sm uppercase tracking-[0.18em] text-black">
                  FarCon Live Auctions
                </div>
                <div className="max-w-xl">
                  <h3 className="!font-space-grotesk text-[clamp(2.5rem,12vw,6.5rem)] font-medium leading-[0.9] text-black">
                    {featuredHero?.artist || "Kismet Casa"}
                  </h3>
                  <p ref={heroDescriptionMeasure.ref} className="mt-4 max-w-md !font-space-grotesk text-sm leading-normal text-black">
                    {heroDescriptionText}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-space-grotesk text-sm">
                  {heroListingId ? (
                    <TransitionLink
                      href={`/listing/${heroListingId}`}
                      prefetch={false}
                      className="bg-black px-2.5 py-1 text-white transition-colors hover:bg-[#222]"
                    >
                      View featured lot
                    </TransitionLink>
                  ) : (
                    <span className="bg-black px-2.5 py-1 text-white">All lots shown below</span>
                  )}
                  <span className="border border-black px-2.5 py-1 text-black">All lots shown below</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
              {(featuredArtworks.length > 0 ? featuredArtworks : kismetTier1Lots.slice(0, 4)).map((auction, index) => (
                <StaticArtworkTile
                  key={auction.listingId}
                  auction={{
                    ...KISMET_CASA_PLACEHOLDERS[index]!,
                    listingId: auction.listingId,
                    tokenId: auction.tokenId || String(index + 1),
                    title: auction.title,
                    artist: auction.artist,
                    description: auction.description,
                    image: auction.image || undefined,
                    thumbnailUrl: auction.thumbnailUrl || undefined,
                  }}
                  gradient={KISMET_GRADIENTS[index % KISMET_GRADIENTS.length]}
                />
              ))}
            </div>
          </div>
        </div>
        <div className={`flex items-center justify-between border-t border-black/10 py-5 font-mek-mono text-sm ${gutter}`}>
          <span>Curated for FarCon</span>
          <span>live auction placeholders</span>
        </div>
      </section>

      {/* Kismet Casa: each lot gets a dedicated section preview */}
      <section className="w-full bg-[#111111]">
        <h2 className={`pb-2 pt-5 font-space-grotesk text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-white ${gutter}`}>
          Kismet Casa lots
        </h2>
        <p ref={lotIntroMeasure.ref} className={`pb-5 font-mek-mono text-sm text-[#aaaaaa] ${gutter}`}>
          {lotIntroText}
        </p>

        <div className="flex flex-col">
          {kismetTier1Lots.map((auction, index) => (
            <KismetLotSection
              key={auction.listingId}
              auction={{
                ...KISMET_CASA_PLACEHOLDERS[index % KISMET_CASA_PLACEHOLDERS.length]!,
                listingId: auction.listingId,
                tokenId: auction.tokenId || String(index + 1),
                title: auction.title,
                artist: auction.artist,
                description: auction.description,
                image: auction.image || undefined,
                thumbnailUrl: auction.thumbnailUrl || undefined,
              }}
              hydratedListing={kismetHydratedLots[auction.listingId]}
              hydrationDone={kismetHydrationDone}
              gradient={KISMET_GRADIENTS[index % KISMET_GRADIENTS.length]}
              gutter={gutter}
            />
          ))}
        </div>
      </section>

      {isMiniApp && !isMiniAppInstalled && actions && (
        <section className="border-b border-[#333333]">
          <div className={`flex items-center justify-center py-3 ${gutter}`}>
            <button
              type="button"
              onClick={actions.addMiniApp}
              className="font-mek-mono text-[#999999] underline decoration-[#999999] hover:text-[#cccccc]"
            >
              Add mini-app to Farcaster
            </button>
          </div>
        </section>
      )}

      {/* Figma: Bids (white) */}
      <section className="w-full bg-white text-black">
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-black ${gutter}`}>
          Bids
        </h2>
        <div className={`flex flex-col divide-y divide-neutral-200 pb-6 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 xl:grid-cols-4 ${gutter}`}>
          {nftLoading || editionLoading ? (
            <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">Loading…</p>
          ) : bidListings.length === 0 ? (
            <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">No bids yet.</p>
          ) : (
            bidListings.map((auction) => (
              <div
                key={auction.id}
                className="flex items-center gap-2.5 p-2.5 md:border md:border-neutral-200"
              >
                <div
                  className="relative h-14 w-12 shrink-0 overflow-hidden bg-neutral-200"
                  style={{ background: KISMET_GRADIENTS[Number(auction.tokenId ?? 1) % KISMET_GRADIENTS.length] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 font-space-grotesk text-sm">
                  <p className="truncate text-black">{auction.title || "Listing"}</p>
                  <p className="truncate text-black">by {auction.artist || "—"}</p>
                </div>
                <div className="shrink-0 text-right font-mek-mono text-sm text-black">
                  <p className="text-black">{formatListingEth({ ...auction, currentPrice: auction.highestBid?.amount })}</p>
                  <p className="text-black">{formatBidder(auction.highestBid?.bidder)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      </div>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />

      {/* Loading Listing Modal - Shows when navigating to a listing */}
      {loadingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-md w-full mx-4 bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
            {/* Image */}
            {loadingListing.image ? (
              <div className="relative w-full aspect-square bg-black">
                <img
                  src={loadingListing.image}
                  alt={loadingListing.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="relative w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
            )}
            
            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-normal text-white mb-2 line-clamp-2">
                {loadingListing.title}
              </h3>
              <div className="flex items-center justify-center gap-2 text-[#999999] text-sm">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Loading listing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatStaticEth(amount: string | undefined) {
  try {
    return `${formatEther(BigInt(amount || "0"))} ETH`;
  } catch {
    return "TBD";
  }
}

function StaticArtworkTile({
  auction,
  gradient,
}: {
  auction: EnrichedAuctionData;
  gradient: string;
}) {
  return (
    <div className="min-h-[160px] border border-black/15 bg-black p-2 text-white">
      <div className="flex h-full flex-col justify-between p-2" style={{ background: gradient }}>
        <span className="self-start bg-black/75 px-2 py-1 font-mek-mono text-xs text-white">
          Lot {auction.tokenId}
        </span>
        <div className="bg-black/70 p-2 font-space-grotesk text-xs">
          <p className="truncate">{auction.title}</p>
          <p className="text-white/70">{formatStaticEth(auction.currentPrice || auction.initialAmount)}</p>
        </div>
      </div>
    </div>
  );
}

function StaticAuctionCard({
  auction,
  gradient,
}: {
  auction: EnrichedAuctionData;
  gradient: string;
}) {
  const price = formatStaticEth(auction.currentPrice || auction.initialAmount);
  const status = auction.highestBid ? "live bid placeholder" : "auction placeholder";

  return (
    <div className="overflow-hidden bg-[#1b1b1b] text-white">
      <div className="relative aspect-square" style={{ background: gradient }}>
        <div className="absolute left-0 top-0 flex items-center gap-2 bg-[#272727] p-2.5">
          <span className="h-2 w-2 bg-[#00ff11]" aria-hidden />
          <span className="font-mek-mono text-xs">{status}</span>
        </div>
        <div className="absolute bottom-0 left-0 bg-white p-2.5 font-mek-mono text-sm text-black">
          {price}
        </div>
      </div>
      <div className="space-y-1 p-2.5 font-mek-mono text-sm">
        <p className="truncate">{auction.title}</p>
        <p className="truncate text-neutral-400">by {auction.artist}</p>
      </div>
    </div>
  );
}

function KismetLotSection({
  auction,
  hydratedListing,
  hydrationDone,
  gradient,
  gutter,
}: {
  auction: EnrichedAuctionData;
  hydratedListing?: Tier2HydrationItem;
  hydrationDone?: boolean;
  gradient: string;
  gutter: string;
}) {
  const displayListing = hydratedListing || auction;
  const price = formatStaticEth(
    (displayListing as Tier2HydrationItem).currentPrice || auction.currentPrice || auction.initialAmount
  );
  const isAuction =
    ((displayListing as Tier2HydrationItem).listingType || auction.listingType) === "INDIVIDUAL_AUCTION";
  const statusText = isAuction ? "Auction lot" : "Fixed price lot";
  const bidCount = (displayListing as Tier2HydrationItem).bidCount || auction.bidCount || 0;
  const bidInfo = isAuction ? `${bidCount} bid${bidCount === 1 ? "" : "s"}` : "Buy now";

  return (
    <article className="border-t border-[#2b2b2b] bg-black text-white">
      <div className={`grid gap-4 py-5 md:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] md:items-start ${gutter}`}>
        <div className="relative aspect-square overflow-hidden border border-white/15" style={{ background: gradient }}>
          <div className="absolute left-2 top-2 bg-black/75 px-2 py-1 font-space-grotesk text-xs text-white">
            Lot {auction.tokenId}
          </div>
          <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 font-space-grotesk text-xs text-white">
            {statusText}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="space-y-1">
            <h3 className="truncate font-space-grotesk text-2xl font-medium text-white">
              {auction.title || `Kismet Casa Lot ${auction.tokenId}`}
            </h3>
            <p className="font-space-grotesk text-sm text-[#c9c9c9]">by {auction.artist || "Kismet Casa"}</p>
          </div>

          <p className="line-clamp-2 font-space-grotesk text-sm text-[#9f9f9f]">
            {auction.description || "Limited lot preview. Open listing for full details and bidding controls."}
          </p>

          {!hydratedListing ? (
            <div className="border border-[#333333] bg-[#151515] p-2.5 font-space-grotesk text-sm text-white">
              a xxx.xx ETH reserve auction
              {hydrationDone ? "" : " ..."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 font-mek-mono text-sm">
              <div className="border border-[#333333] bg-[#151515] p-2.5">
                <p className="text-[#8f8f8f]">Current</p>
                <p className="text-white">{price}</p>
              </div>
              <div className="border border-[#333333] bg-[#151515] p-2.5">
                <p className="text-[#8f8f8f]">Status</p>
                <p className="text-white">{bidInfo}</p>
              </div>
            </div>
          )}

          <div>
            <TransitionLink
              href={`/listing/${auction.listingId}`}
              prefetch={false}
              className="inline-flex items-center border border-white/25 px-3 py-2 font-space-grotesk text-sm text-white transition-colors hover:bg-white hover:text-black"
            >
              View listing
            </TransitionLink>
          </div>
        </div>
      </div>
    </article>
  );
}

