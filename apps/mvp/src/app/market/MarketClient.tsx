"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { RecentListingsTable } from "~/components/RecentListingsTable";
import type { EnrichedAuctionData } from "~/lib/types";

type BrowseApiJson = {
  success?: boolean;
  listings?: EnrichedAuctionData[];
  subgraphDown?: boolean;
  degraded?: boolean;
  pagination?: { hasMore?: boolean };
};

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

export type MarketInitialPayload = {
  tab: "all" | "recent";
  listings: EnrichedAuctionData[];
  hasMore: boolean;
  subgraphDown: boolean;
  degraded: boolean;
};

type MarketClientProps = {
  initial: MarketInitialPayload;
};

const PAGE_SIZE = 20;
/** Safety net for slow networks (subgraph-only responses should be fast) */
const BROWSE_FETCH_MAX_MS = 45_000;

export default function MarketClient({ initial }: MarketClientProps) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "recent" ? "recent" : "all";

  const [listings, setListings] = useState<EnrichedAuctionData[]>(initial.listings);
  const [loading, setLoading] = useState(() => {
    const needsClientFetch =
      initial.degraded ||
      (initial.listings.length === 0 && (initial.subgraphDown || initial.degraded));
    const emptyOk =
      initial.listings.length === 0 && !initial.subgraphDown && !initial.degraded;
    if (emptyOk) return false;
    if (initial.listings.length > 0) return false;
    return needsClientFetch;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [subgraphDown, setSubgraphDown] = useState(initial.subgraphDown);
  const [degraded, setDegraded] = useState(initial.degraded);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [refetchNonce, setRefetchNonce] = useState(0);

  const fetchAbortRef = useRef<AbortController | null>(null);

  /** Prefer SSR / server-first paint; allow override after user Retry or client-only recovery. */
  const shouldSkipStreamPageZero = useMemo(() => {
    if (refetchNonce > 0) return false;
    if (initial.degraded) return false;
    if (initial.listings.length > 0) return true;
    return initial.listings.length === 0 && !initial.subgraphDown && !initial.degraded;
  }, [initial.degraded, initial.listings.length, initial.subgraphDown, refetchNonce]);

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      const isInitialLoad = page === 0;
      if (isInitialLoad && shouldSkipStreamPageZero) {
        setLoading(false);
        return;
      }

      if (isInitialLoad) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
        setLoadMoreError(null);
      }

      fetchAbortRef.current?.abort();
      const ac = new AbortController();
      fetchAbortRef.current = ac;
      let fetchTimedOut = false;
      const maxTimer = setTimeout(() => {
        fetchTimedOut = true;
        ac.abort();
      }, BROWSE_FETCH_MAX_MS);

      try {
        const skip = page * PAGE_SIZE;
        const orderBy = tab === "recent" ? "createdAt" : "listingId";
        const url = `/api/listings/browse?first=${PAGE_SIZE}&skip=${skip}&enrich=false&stream=false&orderBy=${orderBy}&orderDirection=desc`;

        const response = await fetch(url, { signal: ac.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as BrowseApiJson;
        const parsed = json.listings ?? [];

        if (cancelled || ac.signal.aborted) return;

        const isBad =
          !!json.subgraphDown ||
          !!json.degraded ||
          response.headers.get("X-Route-Degraded") === "true";

        if (page === 0) {
          setListings(parsed);
          setSubgraphDown(!!json.subgraphDown);
          setDegraded(!!json.degraded || isBad);
        } else {
          setListings((prev) => {
            const ids = new Set(prev.map((l) => l.listingId));
            const next = parsed.filter((l) => !ids.has(l.listingId));
            return [...prev, ...next];
          });
          setSubgraphDown((prev) => prev || !!json.subgraphDown);
        }

        const more =
          json.pagination?.hasMore ??
          (parsed.length === PAGE_SIZE && parsed.length > 0);
        setHasMore(!!more);
      } catch (err: unknown) {
        clearTimeout(maxTimer);
        if (err instanceof Error && err.name === "AbortError") {
          // Intentional abort (navigation / new fetch): ignore. Client max wait: show message.
          if (!cancelled && fetchTimedOut) {
            const timeoutMsg =
              "Request took too long — the listings service may be slow or unavailable. Try again.";
            if (isInitialLoad) {
              setError(timeoutMsg);
              setListings([]);
            } else {
              setLoadMoreError(timeoutMsg);
            }
          }
          return;
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch listings";
        if (isInitialLoad) {
          setError(errorMessage);
          setListings([]);
        } else {
          setLoadMoreError(errorMessage);
        }
      } finally {
        clearTimeout(maxTimer);
        if (!cancelled) {
          if (isInitialLoad) setLoading(false);
          else setLoadingMore(false);
        }
      }
    }

    void fetchListings();

    return () => {
      cancelled = true;
      fetchAbortRef.current?.abort();
    };
  }, [page, tab, shouldSkipStreamPageZero]);

  useEffect(() => {
    setListings(initial.listings);
    setHasMore(initial.hasMore);
    setSubgraphDown(initial.subgraphDown);
    setDegraded(initial.degraded);
    const needsClientFetch =
      initial.degraded ||
      (initial.listings.length === 0 && (initial.subgraphDown || initial.degraded));
    const emptyOk =
      initial.listings.length === 0 && !initial.subgraphDown && !initial.degraded;
    setLoading(() => {
      if (emptyOk) return false;
      if (initial.listings.length > 0) return false;
      return needsClientFetch;
    });
    setPage(0);
  }, [initial]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const retryLoadMore = () => {
    setLoadMoreError(null);
    loadMore();
  };

  const showDegradedBanner =
    (degraded || subgraphDown) && listings.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      {showDegradedBanner && (
        <section className="border-b border-[#333333] bg-[#221f12] px-5 py-2">
          <p className="font-mek-mono text-xs text-[#f6d87d]">
            Live listing data may be incomplete or delayed while services catch up. Showing what we have.
          </p>
        </section>
      )}

      <div className="px-5 py-8">
        <h1 className="text-2xl font-light mb-6">Market</h1>

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
          <MarketGridSkeleton tab={tab} />
        ) : error && listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading listings</p>
            <p className="text-[#999999] text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setRefetchNonce((n) => n + 1);
                setPage(0);
                setListings([]);
                setError(null);
                setLoading(true);
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
                <p className="text-[#999999] text-sm mb-4">
                  The data service is temporarily unavailable. Please check back later.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRefetchNonce((n) => n + 1);
                    setSubgraphDown(false);
                    setDegraded(false);
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
            <RecentListingsTable listings={listings} loading={false} />

            {loadingMore && (
              <div className="mt-8 text-center py-6">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#cccccc] text-sm">Loading more listings...</p>
                </div>
              </div>
            )}

            {loadMoreError && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-red-400 text-sm mb-3">{loadMoreError}</p>
                <button
                  type="button"
                  onClick={retryLoadMore}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {hasMore && !loadingMore && !loadMoreError && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load More
                </button>
              </div>
            )}

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

            {loadingMore && (
              <div className="mt-8 text-center py-6">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#cccccc] text-sm">Loading more listings...</p>
                </div>
              </div>
            )}

            {loadMoreError && !loadingMore && (
              <div className="mt-8 text-center py-6">
                <p className="text-red-400 text-sm mb-3">{loadMoreError}</p>
                <button
                  type="button"
                  onClick={retryLoadMore}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {hasMore && !loadingMore && !loadMoreError && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load More
                </button>
              </div>
            )}

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

function MarketGridSkeleton({ tab }: { tab: "all" | "recent" }) {
  if (tab === "recent") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded border border-[#2a2a2a] bg-[#141414]"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] animate-pulse rounded border border-[#2a2a2a] bg-[#141414]"
        />
      ))}
    </div>
  );
}
