"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { MarketHero } from "~/components/market/MarketHero";
import { MarketSections } from "~/components/market/MarketSections";
import type { EnrichedAuctionData } from "~/lib/types";
import type { HomepageSection } from "~/lib/server/homepage-layout";
import type { MarketBrowseMode } from "~/lib/market-visibility";
import { consumeBrowseListingsStream } from "~/lib/browse-stream-client";

function marketModeFromSearch(raw: string | null): MarketBrowseMode {
  if (raw === "include-ended" || raw === "finished") return "include-ended";
  return "live";
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
  marketMode: MarketBrowseMode;
  listings: EnrichedAuctionData[];
  hasMore: boolean;
  subgraphDown: boolean;
  degraded: boolean;
  ssrEnriched: boolean;
  hero: EnrichedAuctionData | null;
  sections: HomepageSection[];
};

const PAGE_SIZE = 20;
const BROWSE_FETCH_MAX_MS = 150_000;

export default function MarketClient({ initial }: { initial: MarketInitialPayload }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketMode = marketModeFromSearch(searchParams.get("mode") ?? searchParams.get("tab"));
  const showEnded = marketMode === "include-ended";
  const [isFilterPending, startFilterTransition] = useTransition();

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
        const url = `/api/listings/browse?first=${PAGE_SIZE}&skip=${skip}&enrich=true&stream=true&orderBy=listingId&orderDirection=desc&marketMode=${encodeURIComponent(marketMode)}`;

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
            const ids = new Set(prev.map((l) => `${l.listingId}-${l.chainId ?? ""}`));
            const next = streamed.filter((l) => !ids.has(`${l.listingId}-${l.chainId ?? ""}`));
            return [...prev, ...next];
          });
          setSubgraphDown((prev) => prev || !!metadata.subgraphDown);
        }

        const more =
          metadata.hasMore ?? (streamed.length === PAGE_SIZE && streamed.length > 0);
        setHasMore(!!more);
      } catch (err: unknown) {
        clearTimeout(maxTimer);
        if (err instanceof Error && err.name === "AbortError") {
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
  }, [page, marketMode, refetchNonce, skipInitialClientEnrich]);

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

  const setShowEnded = (next: boolean) => {
    startFilterTransition(() => {
      router.push(next ? "/market?mode=include-ended" : "/market");
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between border-b border-[#333333] px-4 py-4">
        <Logo />
        <ProfileDropdown />
      </header>

      {showDegradedBanner && (
        <section className="border-b border-[#333333] bg-[#221f12] px-5 py-2">
          <p className="font-mek-mono text-xs text-[#f6d87d]">
            Live listing data may be incomplete or delayed while services catch up. Showing what we have.
          </p>
        </section>
      )}

      <div className="px-5 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-light">Market</h1>
            <p className="mt-1 max-w-xl text-sm text-[#999999]">
              Live auctions, listings awaiting first bid, and open sales — including partially sold editions.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 font-mek-mono text-xs tracking-[0.5px] text-[#cccccc]">
            <input
              type="checkbox"
              checked={showEnded}
              onChange={(e) => setShowEnded(e.target.checked)}
              className="h-4 w-4 rounded border-[#666666] bg-black accent-white"
            />
            Show ended & sold out
          </label>
        </div>

        {initial.hero ? <MarketHero auction={initial.hero} /> : null}
        <MarketSections sections={initial.sections} />

        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#333333] pb-3">
          <h2 className="font-mek-mono text-sm uppercase tracking-[0.5px] text-white">
            All listings
          </h2>
          {isFilterPending ? (
            <span className="font-mek-mono text-xs text-[#999999]">Updating…</span>
          ) : null}
        </div>

        <div
          className={
            isFilterPending ? "pointer-events-none opacity-45 transition-opacity duration-150" : undefined
          }
        >
          {loading && listings.length === 0 ? (
            <MarketGridSkeleton />
          ) : error && listings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-2 text-red-400">Error loading listings</p>
              <p className="mb-4 text-sm text-[#999999]">{error}</p>
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
            <div className="py-12 text-center">
              {subgraphDown ? (
                <>
                  <p className="mb-2 text-[#cccccc]">Unable to load listings</p>
                  <p className="mb-4 text-sm text-[#999999]">
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
                    className="text-sm text-white hover:underline"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <p className="text-[#cccccc]">
                  {showEnded
                    ? "No listings match this view right now."
                    : "No open listings right now. Try showing ended & sold out."}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {listings.map((listing, index) => (
                  <AuctionCard
                    key={`${String(listing.listingId)}-${String(listing.chainId ?? "")}`}
                    auction={listing}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>

              {loadingMore && (
                <div className="mt-8 py-6 text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <p className="text-sm text-[#cccccc]">Loading more listings…</p>
                  </div>
                </div>
              )}

              {loadMoreError && !loadingMore && (
                <div className="mt-8 py-6 text-center">
                  <p className="mb-3 text-sm text-red-400">{loadMoreError}</p>
                  <button
                    type="button"
                    onClick={retryLoadMore}
                    className="border border-[#666666] px-4 py-1.5 text-sm text-white transition-colors hover:border-white"
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
                    className="bg-white px-6 py-2 text-sm font-medium tracking-[0.5px] text-black transition-colors hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Load More
                  </button>
                </div>
              )}

              {!hasMore && listings.length > 0 && !loadingMore && (
                <div className="mt-8 py-6 text-center">
                  <p className="text-xs text-[#666666]">No more listings to load</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] animate-pulse rounded border border-[#2a2a2a] bg-[#141414]"
        />
      ))}
    </div>
  );
}
