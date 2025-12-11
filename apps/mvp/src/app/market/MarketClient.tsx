"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { RecentListingsTable } from "~/components/RecentListingsTable";
import type { EnrichedAuctionData } from "~/lib/types";

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

export default function MarketClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const [listings, setListings] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [subgraphDown, setSubgraphDown] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    async function fetchListings() {
      const isInitialLoad = page === 0;
      if (isInitialLoad) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
        setLoadMoreError(null);
      }
      
      try {
        const skip = page * pageSize;
        let url: string;
        
        if (tab === "recent") {
          // Recent listings ordered by creation date
          url = `/api/listings/browse?first=${pageSize}&skip=${skip}&enrich=true&orderBy=createdAt&orderDirection=desc`;
        } else {
          // All listings ordered by listing ID
          url = `/api/listings/browse?first=${pageSize}&skip=${skip}&enrich=true&orderBy=listingId&orderDirection=desc`;
        }
        
        console.log('[MarketClient] Fetching listings from:', url);
        const response = await fetch(url);
        console.log('[MarketClient] Response status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[MarketClient] Response error:', errorText);
          throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('[MarketClient] Received data:', {
          success: data.success,
          listingsCount: data.listings?.length || 0,
          error: data.error,
          hasMore: data.pagination?.hasMore,
        });
        if (data.error) {
          console.error('[MarketClient] API returned error:', data.error);
          if (isInitialLoad) {
            setError(data.error);
          } else {
            setLoadMoreError(data.error);
          }
        }
        if (!data.success) {
          const errorMsg = data.error || 'Failed to fetch listings';
          if (isInitialLoad) {
            setError(errorMsg);
          } else {
            setLoadMoreError(errorMsg);
          }
        }
        if (page === 0) {
          setListings(data.listings || []);
          setSubgraphDown(data.subgraphDown || false);
        } else {
          setListings((prev) => [...prev, ...(data.listings || [])]);
        }
        setHasMore(data.pagination?.hasMore || false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch listings';
        console.error("[MarketClient] Error fetching listings:", errorMessage, error);
        if (isInitialLoad) {
          setError(errorMessage);
          // Set empty array on error to show error message instead of infinite loading
          setListings([]);
        } else {
          setLoadMoreError(errorMessage);
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    }

    fetchListings();
  }, [page, tab]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const retryLoadMore = () => {
    setLoadMoreError(null);
    loadMore();
  };

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
    setListings([]);
    setLoadMoreError(null);
    setHasMore(true);
  }, [tab]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      <div className="px-5 py-8">
        <h1 className="text-2xl font-light mb-6">Market</h1>

        {/* Tabs */}
        <div className="flex gap-6 mb-8 border-b border-[#333333]">
          <TransitionLink
            href="/market"
            prefetch={false}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              tab === "all"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            All Listings
          </TransitionLink>
          <TransitionLink
            href="/market?tab=recent"
            prefetch={false}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              tab === "recent"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Recent
          </TransitionLink>
        </div>

        {loading && listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading listings...</p>
          </div>
        ) : error && listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading listings</p>
            <p className="text-[#999999] text-sm mb-4">{error}</p>
            <button
              onClick={() => {
                setPage(0);
                setListings([]);
                setError(null);
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            {subgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load listings</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setSubgraphDown(false);
                    setPage(0);
                    setError(null);
                    setLoading(true);
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <p className="text-[#cccccc]">No listings found</p>
            )}
          </div>
        ) : tab === "recent" ? (
          <>
            <RecentListingsTable listings={listings} loading={loading} />

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="mt-8 text-center py-6">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#cccccc] text-sm">Loading more listings...</p>
                </div>
              </div>
            )}

            {/* Load more error */}
            {loadMoreError && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-red-400 text-sm mb-3">{loadMoreError}</p>
                <button
                  onClick={retryLoadMore}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Load more button */}
            {hasMore && !loadingMore && !loadMoreError && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load More
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && listings.length > 0 && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-[#666666] text-xs">No more listings to load</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {listings.map((listing, index) => (
                <AuctionCard
                  key={listing.listingId}
                  auction={listing}
                  gradient={gradients[index % gradients.length]}
                  index={index}
                />
              ))}
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="mt-8 text-center py-6">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#cccccc] text-sm">Loading more listings...</p>
                </div>
              </div>
            )}

            {/* Load more error */}
            {loadMoreError && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-red-400 text-sm mb-3">{loadMoreError}</p>
                <button
                  onClick={retryLoadMore}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Load more button */}
            {hasMore && !loadingMore && !loadMoreError && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load More
                </button>
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && listings.length > 0 && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-[#666666] text-xs">No more listings to load</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

