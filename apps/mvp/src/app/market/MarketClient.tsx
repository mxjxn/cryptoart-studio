"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import type { EnrichedAuctionData } from "~/lib/types";
import type { MarketLifecycleTab } from "~/lib/market-lifecycle";
import { consumeBrowseListingsStream } from "~/lib/browse-stream-client";

function marketTabFromSearch(raw: string | null): MarketLifecycleTab {
  if (raw === "upcoming" || raw === "finished") return raw;
  return "active";
}

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

export type MarketInitialPayload = {
  tab: MarketLifecycleTab;
  listings: EnrichedAuctionData[];
  hasMore: boolean;
  subgraphDown: boolean;
  degraded: boolean;
  /** True when listings were enriched on the server (prerender / ISR) — skip duplicate client fetch for page 0. */
  ssrEnriched: boolean;
};

type MarketClientProps = {
  initial: MarketInitialPayload;
};

const PAGE_SIZE = 20;
/** Lifecycle + load-more can exceed 60s of enrichment; stay above browse stream wall + network */
const BROWSE_FETCH_MAX_MS = 150_000;

export default function MarketClient({ initial }: MarketClientProps) {
  const searchParams = useSearchParams();
  const tab = marketTabFromSearch(searchParams.get("tab"));

  const [listings, setListings] = useState<EnrichedAuctionData[]>(initial.listings);
  const [loading, setLoading] = useState(() => {
    if (
      initial.ssrEnriched &&
      initial.listings.length > 0 &&
      !initial.degraded &&
      !initial.subgraphDown
    ) {
      return false;
    }
    return true;
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

  /** SSR/ISR already shipped enriched cards — avoid re-fetching the same page on hydrate. */
  const skipInitialClientEnrich = useMemo(() => {
    if (refetchNonce > 0) return false;
    if (!initial.ssrEnriched) return false;
    if (initial.degraded || initial.subgraphDown) return false;
    return initial.listings.length > 0;
  }, [
    initial.ssrEnriched,
    initial.degraded,
    initial.subgraphDown,
    initial.listings.length,
    refetchNonce,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      const isInitialLoad = page === 0;
      if (isInitialLoad && skipInitialClientEnrich) {
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
        const orderBy = tab === "finished" ? "updatedAt" : "listingId";
        const url = `/api/listings/browse?first=${PAGE_SIZE}&skip=${skip}&enrich=true&stream=true&orderBy=${orderBy}&orderDirection=desc&lifecycle=${encodeURIComponent(tab)}`;

        const response = await fetch(url, { signal: ac.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const pageAtStart = page;
        const { listings: streamed, metadata } = await consumeBrowseListingsStream(response, {
          signal: ac.signal,
          onListing: (_listing, accumulated) => {
            if (cancelled || ac.signal.aborted || pageAtStart !== 0) return;
            setListings([...accumulated]);
          },
        });

        if (cancelled || ac.signal.aborted) return;

        const isBad = !!metadata.subgraphDown || !!metadata.degraded;

        if (pageAtStart === 0) {
          setListings(streamed);
          setSubgraphDown(!!metadata.subgraphDown);
          setDegraded(!!metadata.degraded || isBad);
        } else {
          setListings((prev) => {
            const ids = new Set(prev.map((l) => l.listingId));
            const next = streamed.filter((l) => !ids.has(l.listingId));
            return [...prev, ...next];
          });
          setSubgraphDown((prev) => prev || !!metadata.subgraphDown);
        }

        const more =
          metadata.hasMore ??
          (streamed.length === PAGE_SIZE && streamed.length > 0);
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
  }, [page, tab, refetchNonce, skipInitialClientEnrich]);

  useEffect(() => {
    setListings(initial.listings);
    setHasMore(initial.hasMore);
    setSubgraphDown(initial.subgraphDown);
    setDegraded(initial.degraded);
    if (
      initial.ssrEnriched &&
      initial.listings.length > 0 &&
      !initial.degraded &&
      !initial.subgraphDown
    ) {
      setLoading(false);
    } else {
      setLoading(true);
    }
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

        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8 border-b border-[#333333]">
          <TransitionLink
            href="/market?tab=active"
            prefetch={false}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              tab === "active"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Active
          </TransitionLink>
          <TransitionLink
            href="/market?tab=upcoming"
            prefetch={false}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              tab === "upcoming"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Upcoming
          </TransitionLink>
          <TransitionLink
            href="/market?tab=finished"
            prefetch={false}
            className={`pb-3 text-sm font-mek-mono tracking-[0.5px] transition-colors ${
              tab === "finished"
                ? "text-white border-b-2 border-white"
                : "text-[#999999] hover:text-white"
            }`}
          >
            Finished
          </TransitionLink>
        </div>

        {loading && listings.length === 0 ? (
          <MarketGridSkeleton />
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
              <p className="text-[#cccccc]">
                {tab === "active" && "No active listings right now."}
                {tab === "upcoming" && "No upcoming listings."}
                {tab === "finished" && "No finished listings yet."}
              </p>
            )}
          </div>
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

function MarketGridSkeleton() {
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
