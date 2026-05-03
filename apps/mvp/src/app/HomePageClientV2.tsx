"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
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
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
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
const FEATURED_HEADER_TEXT = "Featured";
/** Used until the featured `<h2>` is measured (clamp typography height is roughly 80–140px). */
const FEATURED_HEADER_HEIGHT_FALLBACK_PX = 120;

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
  /** `NEXT_PUBLIC_HOME_TEASER=true` — same layout as the full homepage, without artwork grids, Bids, or per-lot sections. */
  const hideAuctionCards = process.env.NEXT_PUBLIC_HOME_TEASER === "true";

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
  const pageRef = useRef<HTMLDivElement>(null);
  const featuredSectionRef = useRef<HTMLElement>(null);
  const featuredHeaderMeasureRef = useRef<HTMLHeadingElement>(null);
  const featuredHeaderHeightMv = useMotionValue(FEATURED_HEADER_HEIGHT_FALLBACK_PX);
  const prefersReducedMotion = useReducedMotion();
  /** Dev-only: preview motion when OS has “Reduce motion” on. Production still respects prefers-reduced-motion. */
  const devForceMotion =
    process.env.NODE_ENV !== "production" && searchParams.get("forceMotion") === "1";
  const shouldAnimate = devForceMotion || !prefersReducedMotion;
  const pretextDebugEnabled = process.env.NODE_ENV !== "production" && searchParams.get("pretextDebug") === "1";
  const motionDebugEnabled = process.env.NODE_ENV !== "production" && searchParams.get("motionDebug") === "1";
  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ["start start", "end end"],
  });
  const pageScrollLogBucketRef = useRef(-1);
  const featuredScrollLogBucketRef = useRef(-1);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, shouldAnimate ? -28 : 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, shouldAnimate ? 0.82 : 1]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, shouldAnimate ? 0.98 : 1]);
  const { scrollYProgress: featuredProgress } = useScroll({
    target: featuredSectionRef,
    offset: ["start end", "end start"],
  });
  /** Progress 0 ≈ section entering; 1 ≈ section has scrolled through — cap overlap so ≤40% of the title is covered. */
  const featuredContentY = useTransform([featuredProgress, featuredHeaderHeightMv], ([p, h]) => {
    if (!shouldAnimate) return 0;
    const H = typeof h === "number" && h > 0 ? h : FEATURED_HEADER_HEIGHT_FALLBACK_PX;
    /** Negative Y pulls content up over the sticky title; limit to 40% of header height worth of overlap. */
    const cap = -0.4 * H;
    const mid = cap * (68 / 120);
    const progress = typeof p === "number" ? p : 0;
    if (progress <= 0.45) return (progress / 0.45) * mid;
    return mid + ((progress - 0.45) / 0.55) * (cap - mid);
  });

  useLayoutEffect(() => {
    const el = featuredHeaderMeasureRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) featuredHeaderHeightMv.set(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [featuredHeaderHeightMv]);

  useEffect(() => {
    if (!motionDebugEnabled) return;
    console.log("[motion-debug] mount", {
      prefersReducedMotion,
      devForceMotion,
      shouldAnimate,
      motionPolicy:
        prefersReducedMotion && !devForceMotion
          ? "reduced — matches prefers-reduced-motion (OS/browser). Add &forceMotion=1 in dev to preview animations."
          : "full",
      href: window.location.href,
    });
  }, [motionDebugEnabled, prefersReducedMotion, devForceMotion, shouldAnimate]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!motionDebugEnabled) return;
    const value = Number(latest.toFixed(3));
    const bucket = Math.min(10, Math.max(0, Math.floor(value * 10)));
    if (bucket !== pageScrollLogBucketRef.current) {
      pageScrollLogBucketRef.current = bucket;
      console.log("[motion-debug] page scroll progress", value);
    }
  });

  useMotionValueEvent(featuredProgress, "change", (latest) => {
    if (!motionDebugEnabled) return;
    const value = Number(latest.toFixed(3));
    const bucket = Math.min(10, Math.max(0, Math.floor(value * 10)));
    if (bucket !== featuredScrollLogBucketRef.current) {
      featuredScrollLogBucketRef.current = bucket;
      console.log("[motion-debug] featured section progress", value);
    }
  });

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
    if (hideAuctionCards) return;
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
  }, [fetchRecentNFTs, hideAuctionCards]);

  // Initialize Editions section
  useEffect(() => {
    if (hideAuctionCards) return;
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
  }, [fetchRecentEditions, hideAuctionCards]);

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
  /** Backgrounds span the full viewport while content stays in the centered column (via gutter). */
  const sectionFullBleed = "relative w-[100vw] max-w-[100vw] shrink-0 ml-[calc(50%-50vw)]";

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
    if (hideAuctionCards) {
      setKismetHydrationDone(true);
      return;
    }

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
  }, [kismetTier1Lots, hideAuctionCards]);

  const showDataDegradedNotice =
    !hideAuctionCards && (nftSubgraphDown || editionSubgraphDown || !!nftError || !!editionError);
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
  const featuredCardMeasure = usePretextMeasure<HTMLDivElement>({
    text: heroDescriptionText,
    font: "400 14px Space Grotesk",
    lineHeightPx: 21,
  });

  const heroCtaClassName =
    "inline-flex min-h-[52px] w-full max-w-none items-center justify-center border-2 border-white bg-transparent px-6 py-3.5 !font-space-grotesk text-base font-medium leading-tight tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black sm:min-h-[60px] sm:min-w-0 sm:flex-1 sm:px-8 sm:py-4 sm:text-lg";

  return (
    <div ref={pageRef} className="flex min-h-screen justify-center overflow-x-clip bg-black">
      <div className="flex w-full max-w-none flex-col border-x border-[#222] bg-transparent shadow-2xl sm:max-w-[min(100%,720px)] md:max-w-[min(100%,900px)] lg:max-w-[min(100%,1100px)] xl:max-w-[min(100%,1280px)]">
      {/* Figma: membership strip */}
      {!membershipLoading && (
        <button
          type="button"
          onClick={() => {
            router.push("/membership");
          }}
          className={`${sectionFullBleed} flex flex-col items-center justify-center gap-1 bg-[#f5b0d3] px-3 py-2.5 text-center font-space-grotesk text-[11px] font-medium leading-snug text-black sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-0 sm:px-4 sm:py-2 sm:text-xs`}
        >
          {isMember ? (
            <span className="text-black">
              Member — thanks for supporting infrastructure & open-source
            </span>
          ) : (
            <>
              <span className="max-w-[42rem] text-black">
                Support infrastructure & open-source behind cryptoart.social
              </span>
              <span className="text-black tabular-nums">0.0001 ETH / month</span>
            </>
          )}
        </button>
      )}

      {showDataDegradedNotice && (
        <section className={`border-b border-[#333333] bg-[#221f12] ${sectionFullBleed}`}>
          <div className={`py-2 font-mek-mono text-xs text-[#f6d87d] ${gutter}`}>
            Live listing data is temporarily degraded. You may see placeholders or delayed updates while services recover.
          </div>
        </section>
      )}

      {/* Figma: identity row */}
      <div className={`${sectionFullBleed} flex items-center justify-between bg-black py-5 font-mek-mono text-sm text-white ${gutter}`}>
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
      <motion.section
        className={`${sectionFullBleed} flex flex-col gap-4 bg-black pb-5 pt-5 md:flex-row md:items-center md:gap-8 md:pb-8 ${gutter}`}
        initial={shouldAnimate ? { opacity: 0, y: 22, scale: 0.985 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
      >
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
          <div className="mt-6 flex w-full max-w-2xl flex-col gap-4 sm:mt-8 sm:flex-row sm:items-stretch sm:gap-5">
            <TransitionLink href="/create" prefetch={false} className={heroCtaClassName}>
              Create listing
            </TransitionLink>
            <TransitionLink href="/market" prefetch={false} className={heroCtaClassName}>
              View all listings
            </TransitionLink>
          </div>
        </div>
      </motion.section>

      {pretextDebugEnabled && (
        <section className={`${sectionFullBleed} border-y border-[#333333] bg-black py-3 font-space-grotesk text-xs text-[#f5b0d3] ${gutter}`}>
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
            <p>
              featured card width: {Math.round(featuredCardMeasure.width)}px
            </p>
          </div>
        </section>
      )}

      {/* Figma: Galleries (lime) */}
      <motion.section
        ref={featuredSectionRef}
        className={`${sectionFullBleed} overflow-x-clip bg-[#dcf54c] text-[#272727]`}
        initial={shouldAnimate ? { opacity: 0, y: 24 } : false}
        whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.h2
          ref={featuredHeaderMeasureRef}
          className={`sticky top-0 z-0 pt-5 font-space-grotesk font-medium leading-[0.9] text-[#999] ${gutter}`}
        >
          <span
            className="block w-full whitespace-nowrap bg-gradient-to-b from-[#a7a7a7] via-[#d3d3d3] to-[#dddddd] bg-clip-text text-[clamp(3.25rem,15vw,5.85rem)] leading-[0.9] text-transparent"
          >
            {FEATURED_HEADER_TEXT}
          </span>
        </motion.h2>
        <motion.div
          className={`relative z-10 mt-0 bg-[#dcf54c] pb-6 ${gutter}`}
          style={{ y: featuredContentY }}
        >
          <div
            className={
              hideAuctionCards
                ? "grid gap-3"
                : "grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-stretch"
            }
          >
            <div className="relative min-h-[360px] overflow-hidden border border-black/15 bg-[#dcf54c] text-black">
              <div
                className="absolute inset-0"
                style={{ background: KISMET_GRADIENTS[0] }}
                aria-hidden
              />
              <div className="absolute inset-0 bg-white/25" aria-hidden />
              <div ref={featuredCardMeasure.ref} className="relative flex min-h-[360px] flex-col justify-between p-4 sm:p-6">
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
                  <span className="border border-black px-2.5 py-1 text-black">
                    {hideAuctionCards ? "Full homepage with live lots — soon" : "All lots shown below"}
                  </span>
                </div>
              </div>
            </div>
            {!hideAuctionCards && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {(featuredArtworks.length > 0 ? featuredArtworks : kismetTier1Lots.slice(0, 6)).slice(0, 6).map((auction, index) => (
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
            )}
          </div>
        </motion.div>
        <div className={`flex items-center justify-between border-t border-black/20 py-2.5 font-mek-mono text-sm text-black ${gutter}`}>
          {hideAuctionCards ? (
            <>
              <span className="text-black">CryptoArt</span>
              <span className="text-black">more sections soon</span>
            </>
          ) : (
            <>
              <span className="text-black">Curated for FarCon</span>
              <span className="text-black">live auction placeholders</span>
            </>
          )}
        </div>
      </motion.section>

      {/* Figma: Bids (white) — after featured, before per-lot sections */}
      {!hideAuctionCards && (
      <section className={`${sectionFullBleed} bg-white text-black`}>
        <h2 className={`pb-2 pt-5 font-mek-mono text-[clamp(2rem,11vw,4.25rem)] font-medium leading-none text-black ${gutter}`}>
          Bids
        </h2>
        <div className={`flex flex-col divide-y divide-neutral-200 pb-6 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 xl:grid-cols-4 ${gutter}`}>
          {nftLoading || editionLoading ? (
            <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">Loading…</p>
          ) : bidListings.length === 0 ? (
            <p className="p-2.5 font-mek-mono text-sm text-neutral-600 md:col-span-2 xl:col-span-4">No bids yet.</p>
          ) : (
            bidListings.map((auction, index) => (
              <div
                key={`${auction.listingId}-${auction.tokenSpec}-${index}`}
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
      )}

      {/* Kismet Casa: each lot gets a dedicated section preview — keep a plain section so lots never sit behind opacity:0 if in-view detection fails */}
      {!hideAuctionCards && (
      <section className={`${sectionFullBleed} bg-[#111111]`}>
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
              shouldAnimate={shouldAnimate}
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
      )}

      {isMiniApp && !isMiniAppInstalled && actions && (
        <section className={`${sectionFullBleed} border-b border-[#333333] bg-black`}>
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
  shouldAnimate,
}: {
  auction: EnrichedAuctionData;
  hydratedListing?: Tier2HydrationItem;
  hydrationDone?: boolean;
  gradient: string;
  gutter: string;
  shouldAnimate: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: lotScrollProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const lotScale = useTransform(lotScrollProgress, (p) => {
    if (!shouldAnimate) return 1;
    const d = Math.abs(p - 0.5) * 2;
    return 1 - Math.min(1, d) * 0.15;
  });
  const lotOpacity = useTransform(lotScrollProgress, (p) => {
    if (!shouldAnimate) return 1;
    const d = Math.abs(p - 0.5) * 2;
    return 0.68 + (1 - Math.min(1, d)) * 0.32;
  });
  const lotRadius = useTransform(lotScrollProgress, (p) => {
    if (!shouldAnimate) return "0px";
    const d = Math.abs(p - 0.5) * 2;
    const t = Math.min(1, d);
    return `${Math.round(t * 20)}px`;
  });

  const displayListing = hydratedListing || auction;
  const listingType = ((displayListing as Tier2HydrationItem).listingType || auction.listingType || "FIXED_PRICE");
  const price = formatStaticEth(
    (displayListing as Tier2HydrationItem).currentPrice || auction.currentPrice || auction.initialAmount
  );
  const isAuction = listingType === "INDIVIDUAL_AUCTION";
  const listingTypeLabel =
    listingType === "INDIVIDUAL_AUCTION"
      ? "Individual auction"
      : listingType === "OFFERS_ONLY"
        ? "Offers only"
        : "Fixed price";
  const listingStatus = (displayListing as Tier2HydrationItem).status || auction.status || "UNKNOWN";
  const bidCount = (displayListing as Tier2HydrationItem).bidCount || auction.bidCount || 0;
  const bidInfo = isAuction ? `${bidCount} bid${bidCount === 1 ? "" : "s"}` : "Buy now";
  const highestBidAmount = auction.highestBid?.amount
    ? formatStaticEth(auction.highestBid.amount)
    : isAuction
      ? hydrationDone
        ? "No bids yet"
        : "Loading..."
      : "N/A";
  const highestBidder = auction.highestBid?.bidder
    ? `${auction.highestBid.bidder.slice(0, 6)}…${auction.highestBid.bidder.slice(-4)}`
    : isAuction
      ? "—"
      : "N/A";
  const seller = auction.seller ? `${auction.seller.slice(0, 6)}…${auction.seller.slice(-4)}` : "—";
  const contract = auction.tokenAddress
    ? `${auction.tokenAddress.slice(0, 6)}…${auction.tokenAddress.slice(-4)}`
    : "—";
  const tokenId = auction.tokenId || "—";
  const quantity = `${auction.totalSold || "0"} / ${auction.totalAvailable || "1"}`;
  const paymentToken =
    !auction.erc20 || auction.erc20 === "0x0000000000000000000000000000000000000000" ? "ETH" : "ERC20";
  const formatTime = (unixSeconds: string | undefined, fallback: string) => {
    if (!unixSeconds || unixSeconds === "0") return fallback;
    const n = Number(unixSeconds);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return new Date(n * 1000).toLocaleString();
  };
  const startsAt = formatTime(auction.startTime, "On first interaction");
  const endsAt = formatTime(auction.endTime, listingType === "OFFERS_ONLY" ? "No end" : "Not set");
  const endTimeSeconds = Number(auction.endTime || "0");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const remainingLabel = (() => {
    if (!Number.isFinite(endTimeSeconds) || endTimeSeconds <= 0) {
      return listingType === "OFFERS_ONLY" ? "No end" : "Not set";
    }
    const remaining = endTimeSeconds - nowSeconds;
    if (remaining <= 0) return "Ended";
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${Math.max(minutes, 1)}m`;
  })();

  return (
    <motion.article
      ref={sectionRef}
      className="border-t border-[#2b2b2b] bg-[#111111] py-2 text-white min-h-[100svh]"
    >
      <motion.div
        className="flex min-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden bg-black shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
        style={{
          scale: lotScale,
          opacity: lotOpacity,
          borderRadius: lotRadius,
          transformOrigin: "center center",
          willChange: shouldAnimate ? "transform, opacity" : undefined,
        }}
      >
        <div
          className="relative flex min-h-[52svh] flex-shrink-0 flex-col justify-end overflow-hidden bg-black sm:min-h-[56svh]"
          style={{ background: gradient }}
        >
          <div className="pointer-events-none absolute inset-0 bg-black/10" />
          <div className="absolute left-2 top-2 z-10 bg-black/75 px-2 py-1 font-space-grotesk text-xs text-white">
            Lot {auction.tokenId}
          </div>
          <div className="absolute right-2 top-2 z-10 border border-white/30 bg-black/60 px-2 py-1 font-mek-mono text-[11px] uppercase tracking-[0.12em] text-white/90">
            {listingType === "INDIVIDUAL_AUCTION" ? "Auction" : "Open sale"}
          </div>
          <div className="relative z-[1] bg-gradient-to-t from-black/65 to-transparent px-0 pb-8 pt-16 sm:px-5 md:px-8 lg:px-12 xl:px-16">
            <h3 className="truncate font-space-grotesk text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[0.9] text-white">
              {auction.title || `Kismet Casa Lot ${auction.tokenId}`}
            </h3>
            <p className="mt-2 font-space-grotesk text-sm text-[#d6d6d6]">by {auction.artist || "Kismet Casa"}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col border-t border-[#2b2b2b] bg-black/95 px-0 py-4 sm:px-5 md:px-8 lg:px-12 xl:px-16">
          <p className="font-space-grotesk text-sm leading-relaxed text-[#a9a9a9]">
            {auction.description || "Limited lot preview. Open listing for full details and bidding controls."}
          </p>
          <div className="mt-3 rounded-sm border border-[#2b2b2b] bg-[#101010] p-3 sm:p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="font-mek-mono text-[10px] uppercase tracking-[0.14em] text-[#8f8f8f]">
                  {isAuction ? "Current bid" : "Current price"}
                </p>
                <p className="mt-1 font-space-grotesk text-[clamp(1.5rem,4.8vw,2.25rem)] leading-none text-white">
                  {price}
                </p>
                <p className="mt-2 font-mek-mono text-xs text-[#b8b8b8]">
                  {isAuction ? `${bidInfo} · ${highestBidder}` : listingTypeLabel}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-mek-mono text-[10px] uppercase tracking-[0.14em] text-[#8f8f8f]">
                  Remaining time
                </p>
                <p className="mt-1 font-space-grotesk text-[clamp(1.35rem,4.2vw,2rem)] leading-none text-white">
                  {remainingLabel}
                </p>
                <p className="mt-2 font-mek-mono text-xs text-[#b8b8b8]">{listingStatus}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-[#262626] pt-3 font-mek-mono text-xs text-[#9b9b9b]">
              <p>
                Recent: <span className="text-[#d7d7d7]">{highestBidAmount}</span>
              </p>
              <p className="mt-1">
                Seller {seller} · Contract {contract} · #{tokenId}
              </p>
              <p className="mt-1">
                Starts {startsAt} · Ends {endsAt} · {quantity} sold · {paymentToken}
              </p>
            </div>
          </div>

          {!hydratedListing && (
            <p className="mt-2 font-mek-mono text-xs text-[#8f8f8f]">
              Loading enriched listing details{hydrationDone ? "." : "..."}
            </p>
          )}

          <div className="mt-3">
            <TransitionLink
              href={`/listing/${auction.listingId}`}
              prefetch={false}
              className="inline-flex items-center border border-white/25 px-3 py-2 font-space-grotesk text-sm text-white transition-colors hover:bg-white hover:text-black"
            >
              View listing
            </TransitionLink>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}

