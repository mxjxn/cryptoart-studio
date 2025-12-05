"use client";

import { useState, useEffect } from "react";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
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
  const [listings, setListings] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      setError(null);
      try {
        const skip = page * pageSize;
        const url = `/api/listings/browse?first=${pageSize}&skip=${skip}&enrich=true&orderBy=listingId&orderDirection=desc`;
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
        });
        if (data.error) {
          console.error('[MarketClient] API returned error:', data.error);
          setError(data.error);
        }
        if (!data.success) {
          setError(data.error || 'Failed to fetch listings');
        }
        if (page === 0) {
          setListings(data.listings || []);
        } else {
          setListings((prev) => [...prev, ...(data.listings || [])]);
        }
        setHasMore(data.pagination?.hasMore || false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch listings';
        console.error("[MarketClient] Error fetching listings:", errorMessage, error);
        setError(errorMessage);
        // Set empty array on error to show error message instead of infinite loading
        if (page === 0) {
          setListings([]);
        }
      } finally {
        console.log('[MarketClient] Setting loading to false');
        setLoading(false);
      }
    }

    fetchListings();
  }, [page]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      <div className="px-5 py-8">
        <h1 className="text-2xl font-light mb-8">Market</h1>

        {/* Future: Add filters here */}
        {/* <div className="mb-6">
          <MarketFilters />
        </div> */}

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
            <p className="text-[#cccccc]">No listings found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((listing, index) => (
                <AuctionCard
                  key={listing.listingId}
                  auction={listing}
                  gradient={gradients[index % gradients.length]}
                  index={index}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

