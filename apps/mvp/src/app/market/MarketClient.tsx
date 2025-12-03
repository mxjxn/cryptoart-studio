"use client";

import { useState, useEffect } from "react";
import { ProfileDropdown } from "~/components/ProfileDropdown";
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      try {
        const skip = page * pageSize;
        const response = await fetch(
          `/api/listings/browse?first=${pageSize}&skip=${skip}&enrich=true&orderBy=listingId&orderDirection=desc`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch listings");
        }
        const data = await response.json();
        if (page === 0) {
          setListings(data.listings || []);
        } else {
          setListings((prev) => [...prev, ...(data.listings || [])]);
        }
        setHasMore(data.pagination?.hasMore || false);
      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
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
      <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
        <div className="text-base font-normal tracking-[0.5px]">cryptoart.social</div>
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

