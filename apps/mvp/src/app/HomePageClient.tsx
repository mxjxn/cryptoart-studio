"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { RecentListingsTable } from "~/components/RecentListingsTable";
import { AuctionCard } from "~/components/AuctionCard";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { HomepageLayout } from "~/components/HomepageLayout";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import type { EnrichedAuctionData } from "~/lib/types";


interface HomePageClientProps {
  initialAuctions?: EnrichedAuctionData[];
}

export default function HomePageClient({ initialAuctions = [] }: HomePageClientProps) {
  const [auctions, setAuctions] = useState<EnrichedAuctionData[]>(initialAuctions);
  // Start with loading true only if we don't have initial data
  const [loading, setLoading] = useState(initialAuctions.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [subgraphDown, setSubgraphDown] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(initialAuctions.length === 0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { isConnected } = useEffectiveAddress();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  ];
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;

  // Fetch recent listings with pagination
  const fetchRecentListings = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
      loadingMoreRef.current = true;
    } else {
      setLoading(true);
      loadingRef.current = true;
    }
    setError(null);
    try {
      const skip = pageNum * pageSize;
      console.log('[HomePageClient] Fetching recent listings...', { pageNum, skip });
      const startTime = Date.now();
      // Fetch recent listings ordered by creation date (newest first)
      const response = await fetch(`/api/listings/browse?first=${pageSize}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true`);
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClient] Fetch completed in', fetchTime, 'ms, status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const parseStartTime = Date.now();
      const data = await response.json();
      const parseTime = Date.now() - parseStartTime;
      console.log('[HomePageClient] JSON parsed in', parseTime, 'ms');
      
      const recentListings = data.listings || [];
      const isSubgraphDown = data.subgraphDown || false;
      console.log('[HomePageClient] Received listings:', recentListings.length, 'hasMore:', data.pagination?.hasMore, 'subgraphDown:', isSubgraphDown);
      
      if (append) {
        setAuctions((prev) => [...prev, ...recentListings]);
      } else {
        setAuctions(recentListings);
        setSubgraphDown(isSubgraphDown);
      }
      const moreAvailable = data.pagination?.hasMore || false;
      setHasMore(moreAvailable);
      hasMoreRef.current = moreAvailable;
      // Clear any previous load more errors on success
      if (append) {
        setLoadMoreError(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch listings';
      console.error('[HomePageClient] Error fetching listings:', errorMessage, error);
      if (append) {
        setLoadMoreError(errorMessage);
      } else {
        setError(errorMessage);
        // Keep using initialAuctions on error for initial load
        setAuctions(initialAuctions);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      } else {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, [initialAuctions, pageSize]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = loadMoreRef.current;
    if (!observer) return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMoreRef.current && !loadingRef.current && !loadingMoreRef.current) {
          setPage((currentPage) => {
            const nextPage = currentPage + 1;
            fetchRecentListings(nextPage, true);
            return nextPage;
          });
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before reaching the bottom
        threshold: 0.1,
      }
    );

    intersectionObserver.observe(observer);

    return () => {
      intersectionObserver.disconnect();
    };
  }, [fetchRecentListings]);

  // Use server-side cached data initially and check for fresh listings
  useEffect(() => {
    // Prevent double-fetching in React Strict Mode
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    // If we have initial auctions from server, use them (they're from ISR cache)
    // Only fetch if we don't have any initial data
    if (initialAuctions.length === 0) {
      fetchRecentListings(0, false);
    } else {
      // We have initial data from server (ISR cache), use it immediately
      setAuctions(initialAuctions);
      // Ensure loading is false since we have data
      setLoading(false);
      loadingRef.current = false;
      // Check if there might be more listings
      const moreAvailable = initialAuctions.length >= pageSize;
      setHasMore(moreAvailable);
      hasMoreRef.current = moreAvailable;
      
      // Optimistically check for fresh listings in the background
      // This provides real-time updates without blocking the initial render
      checkForFreshListings();
    }
  }, []); // Empty deps - only run once on mount

  // Check for fresh listings that may have appeared since the ISR cache was generated
  const checkForFreshListings = useCallback(async () => {
    if (initialAuctions.length === 0) return;
    
    try {
      // Get the most recent listing ID from our initial data
      const mostRecentId = initialAuctions[0]?.listingId;
      if (!mostRecentId) return;
      
      // Fetch just the first few listings to see if there are any new ones
      const response = await fetch(`/api/listings/browse?first=5&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true`);
      if (!response.ok) return;
      
      const data = await response.json();
      const freshListings = data.listings || [];
      
      // Find any listings newer than what we have
      const newListings = freshListings.filter((listing: EnrichedAuctionData) => 
        !initialAuctions.some(existing => existing.listingId === listing.listingId)
      );
      
      // If we found new listings, prepend them to the list
      if (newListings.length > 0) {
        console.log(`[HomePageClient] Found ${newListings.length} fresh listings, prepending to list`);
        setAuctions(prev => [...newListings, ...prev]);
      }
    } catch (error) {
      // Silently fail - this is an optimization, not critical
      console.debug('[HomePageClient] Error checking for fresh listings:', error);
    }
  }, [initialAuctions]);


  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      {/* Create Listing Button - Minimal */}
      {isMember && (
        <section className="border-b border-[#333333]">
          <div className="px-5 py-3 flex justify-center">
            <TransitionLink
              href="/create"
              prefetch={false}
              className="text-sm text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
            >
              + Create Listing
            </TransitionLink>
          </div>
        </section>
      )}

      {/* Homepage Layout (driven by admin arranger) */}
      <HomepageLayout />

      {/* Add Mini App Banner - Only show in miniapp context if not already added */}
      {isMiniApp && !isMiniAppInstalled && actions && (
        <section className="border-b border-[#333333]">
          <div className="px-5 py-3 flex justify-center items-center">
            <button
              onClick={actions.addMiniApp}
              className="text-[24px] font-mek-mono text-[#999999] hover:text-[#cccccc] transition-colors underline"
            >
              Add mini-app to Farcaster
            </button>
          </div>
        </section>
      )}

      {/* Membership Banner - Only show if not a member */}
      {!membershipLoading && !isMember && (
        <section className="border-b border-[#333333] bg-[#0a0a0a]">
          <div className="px-5 py-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-bold text-[#ff6b35] tracking-[0.5px]">
                Mint Member for early access
              </div>
              <div className="text-xs font-normal text-[#999999]">
                only 0.0001 ETH/month
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => {
                  if (isConnected) {
                    router.push("/membership");
                  } else if (openConnectModal) {
                    openConnectModal();
                  }
                }}
                className="px-6 py-2.5 bg-[#ff6b35] text-black text-sm font-bold tracking-[0.5px] hover:bg-[#ff8555] transition-colors whitespace-nowrap"
              >
                Mint Member
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent Listings */}
      <section id="listings" className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono">
            Recent Listings
          </h2>
          <div className="flex items-center gap-3">
            {auctions.length > 0 && (
              <TransitionLink
                href="/market?tab=recent"
                prefetch={false}
                className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
              >
                View All Recent →
              </TransitionLink>
            )}
            <div className="flex items-center gap-2 text-xs text-[#999999] font-mek-mono">
              <span>View</span>
              <div className="flex rounded border border-[#333333] overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-2 py-1 transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-black"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-2 py-1 transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-black"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading listings...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading listings</p>
            <p className="text-[#999999] text-sm mb-4">{error}</p>
            <button
              onClick={() => {
                setAuctions([]);
                setPage(0);
                fetchRecentListings(0, false);
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            {subgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load listings</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setSubgraphDown(false);
                    fetchRecentListings(0, false);
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-[#cccccc] mb-4">No listings found</p>
                {isMember && (
                  <TransitionLink
                    href="/create"
                    prefetch={false}
                    className="text-white hover:underline"
                  >
                    Create your first listing
                  </TransitionLink>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {viewMode === "list" ? (
              <RecentListingsTable listings={auctions} loading={false} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {auctions.map((auction, index) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>
            )}
            {/* Intersection observer target for infinite scroll */}
            <div ref={loadMoreRef} className="h-1" />
            {/* Loading indicator when loading more */}
            {loadingMore && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#cccccc] text-sm">Loading more listings...</p>
                </div>
              </div>
            )}

            {/* Load more error */}
            {loadMoreError && !loadingMore && (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm mb-3">{loadMoreError}</p>
                <button
                  onClick={() => {
                    setLoadMoreError(null);
                    setPage((currentPage) => {
                      const nextPage = currentPage + 1;
                      fetchRecentListings(nextPage, true);
                      return nextPage;
                    });
                  }}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && auctions.length > 0 && !loadingMore && !loadMoreError && (
              <div className="text-center py-8">
                <p className="text-[#666666] text-xs">No more listings to load</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />
    </div>
  );
}

