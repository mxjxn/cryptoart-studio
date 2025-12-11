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


// Helper function to check if a listing is ERC721
function isERC721(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC721" || String(tokenSpec) === "1";
}

// Helper function to check if a listing is ERC1155
function isERC1155(tokenSpec: EnrichedAuctionData["tokenSpec"]): boolean {
  return tokenSpec === "ERC1155" || String(tokenSpec) === "2";
}

export default function HomePageClient() {
  // Recent NFTs (ERC721) state
  const [nftListings, setNftListings] = useState<EnrichedAuctionData[]>([]);
  const [nftLoading, setNftLoading] = useState(true);
  const [nftLoadingMore, setNftLoadingMore] = useState(false);
  const [nftError, setNftError] = useState<string | null>(null);
  const [nftLoadMoreError, setNftLoadMoreError] = useState<string | null>(null);
  const [nftSubgraphDown, setNftSubgraphDown] = useState(false);
  const [nftPage, setNftPage] = useState(0);
  const [nftHasMore, setNftHasMore] = useState(true);
  const nftLoadMoreRef = useRef<HTMLDivElement>(null);
  const nftLoadingRef = useRef(true);
  const nftLoadingMoreRef = useRef(false);
  const nftHasMoreRef = useRef(true);
  const nftHasInitializedRef = useRef(false);

  // Recent Editions (ERC1155) state
  const [editionListings, setEditionListings] = useState<EnrichedAuctionData[]>([]);
  const [editionLoading, setEditionLoading] = useState(true);
  const [editionLoadingMore, setEditionLoadingMore] = useState(false);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [editionLoadMoreError, setEditionLoadMoreError] = useState<string | null>(null);
  const [editionSubgraphDown, setEditionSubgraphDown] = useState(false);
  const [editionPage, setEditionPage] = useState(0);
  const [editionHasMore, setEditionHasMore] = useState(true);
  const editionLoadMoreRef = useRef<HTMLDivElement>(null);
  const editionLoadingRef = useRef(true);
  const editionLoadingMoreRef = useRef(false);
  const editionHasMoreRef = useRef(true);
  const editionHasInitializedRef = useRef(false);

  const pageSize = 40; // Fetch 40 listings per section
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

  // Fetch recent NFTs (ERC721) with pagination
  const fetchRecentNFTs = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setNftLoadingMore(true);
      nftLoadingMoreRef.current = true;
    } else {
      setNftLoading(true);
      nftLoadingRef.current = true;
    }
    setNftError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = pageSize * 2; // Fetch 2x to ensure we get enough after filtering
      const skip = pageNum * pageSize;
      console.log('[HomePageClient] Fetching recent NFTs...', { pageNum, skip, fetchCount });
      const startTime = Date.now();
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true`);
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClient] NFT fetch completed in', fetchTime, 'ms, status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const allListings = data.listings || [];
      // Filter for ERC721 only
      const nftListings = allListings.filter((listing: EnrichedAuctionData) => isERC721(listing.tokenSpec));
      const isSubgraphDown = data.subgraphDown || false;
      console.log('[HomePageClient] Received NFTs:', nftListings.length, 'from', allListings.length, 'total listings');
      
      // Take only the requested amount
      const listingsToAdd = nftListings.slice(0, pageSize);
      
      if (append) {
        setNftListings((prev) => [...prev, ...listingsToAdd]);
      } else {
        setNftListings(listingsToAdd);
        setNftSubgraphDown(isSubgraphDown);
      }
      
      // Check if there might be more (if we got the full fetchCount and still have more after filtering)
      const moreAvailable = allListings.length === fetchCount && (nftListings.length >= pageSize || data.pagination?.hasMore);
      setNftHasMore(moreAvailable);
      nftHasMoreRef.current = moreAvailable;
      
      if (append) {
        setNftLoadMoreError(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
      console.error('[HomePageClient] Error fetching NFTs:', errorMessage, error);
      if (append) {
        setNftLoadMoreError(errorMessage);
      } else {
        setNftError(errorMessage);
      }
    } finally {
      if (append) {
        setNftLoadingMore(false);
        nftLoadingMoreRef.current = false;
      } else {
        setNftLoading(false);
        nftLoadingRef.current = false;
      }
    }
  }, [pageSize]);

  // Fetch recent Editions (ERC1155) with pagination
  const fetchRecentEditions = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setEditionLoadingMore(true);
      editionLoadingMoreRef.current = true;
    } else {
      setEditionLoading(true);
      editionLoadingRef.current = true;
    }
    setEditionError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = pageSize * 2; // Fetch 2x to ensure we get enough after filtering
      const skip = pageNum * pageSize;
      console.log('[HomePageClient] Fetching recent Editions...', { pageNum, skip, fetchCount });
      const startTime = Date.now();
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=${skip}&orderBy=createdAt&orderDirection=desc&enrich=true`);
      const fetchTime = Date.now() - startTime;
      console.log('[HomePageClient] Edition fetch completed in', fetchTime, 'ms, status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const allListings = data.listings || [];
      // Filter for ERC1155 only
      const editionListings = allListings.filter((listing: EnrichedAuctionData) => isERC1155(listing.tokenSpec));
      const isSubgraphDown = data.subgraphDown || false;
      console.log('[HomePageClient] Received Editions:', editionListings.length, 'from', allListings.length, 'total listings');
      
      // Take only the requested amount
      const listingsToAdd = editionListings.slice(0, pageSize);
      
      if (append) {
        setEditionListings((prev) => [...prev, ...listingsToAdd]);
      } else {
        setEditionListings(listingsToAdd);
        setEditionSubgraphDown(isSubgraphDown);
      }
      
      // Check if there might be more (if we got the full fetchCount and still have more after filtering)
      const moreAvailable = allListings.length === fetchCount && (editionListings.length >= pageSize || data.pagination?.hasMore);
      setEditionHasMore(moreAvailable);
      editionHasMoreRef.current = moreAvailable;
      
      if (append) {
        setEditionLoadMoreError(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Editions';
      console.error('[HomePageClient] Error fetching Editions:', errorMessage, error);
      if (append) {
        setEditionLoadMoreError(errorMessage);
      } else {
        setEditionError(errorMessage);
      }
    } finally {
      if (append) {
        setEditionLoadingMore(false);
        editionLoadingMoreRef.current = false;
      } else {
        setEditionLoading(false);
        editionLoadingRef.current = false;
      }
    }
  }, [pageSize]);

  // Set up intersection observer for NFTs infinite scroll
  useEffect(() => {
    const observer = nftLoadMoreRef.current;
    if (!observer) return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && nftHasMoreRef.current && !nftLoadingRef.current && !nftLoadingMoreRef.current) {
          setNftPage((currentPage) => {
            const nextPage = currentPage + 1;
            fetchRecentNFTs(nextPage, true);
            return nextPage;
          });
        }
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    intersectionObserver.observe(observer);

    return () => {
      intersectionObserver.disconnect();
    };
  }, [fetchRecentNFTs]);

  // Set up intersection observer for Editions infinite scroll
  useEffect(() => {
    const observer = editionLoadMoreRef.current;
    if (!observer) return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && editionHasMoreRef.current && !editionLoadingRef.current && !editionLoadingMoreRef.current) {
          setEditionPage((currentPage) => {
            const nextPage = currentPage + 1;
            fetchRecentEditions(nextPage, true);
            return nextPage;
          });
        }
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    intersectionObserver.observe(observer);

    return () => {
      intersectionObserver.disconnect();
    };
  }, [fetchRecentEditions]);

  // Initialize NFTs section
  useEffect(() => {
    if (nftHasInitializedRef.current) return;
    nftHasInitializedRef.current = true;
    fetchRecentNFTs(0, false);
  }, [fetchRecentNFTs]);

  // Initialize Editions section
  useEffect(() => {
    if (editionHasInitializedRef.current) return;
    editionHasInitializedRef.current = true;
    fetchRecentEditions(0, false);
  }, [fetchRecentEditions]);


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

      {/* Recent NFTs (721s) */}
      <section id="nfts" className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono">
            Recent NFTs
          </h2>
          <div className="flex items-center gap-3">
            {nftListings.length > 0 && (
              <TransitionLink
                href="/market?tab=recent"
                prefetch={false}
                className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
              >
                View All →
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

        {nftLoading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading NFTs...</p>
          </div>
        ) : nftError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading NFTs</p>
            <p className="text-[#999999] text-sm mb-4">{nftError}</p>
            <button
              onClick={() => {
                setNftListings([]);
                setNftPage(0);
                fetchRecentNFTs(0, false);
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : nftListings.length === 0 ? (
          <div className="text-center py-12">
            {nftSubgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load NFTs</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setNftSubgraphDown(false);
                    fetchRecentNFTs(0, false);
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-[#cccccc] mb-4">No NFTs found</p>
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
              <RecentListingsTable listings={nftListings} loading={false} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nftListings.map((auction, index) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>
            )}
            <div ref={nftLoadMoreRef} className="h-1" />
            {nftLoadingMore && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#cccccc] text-sm">Loading more NFTs...</p>
                </div>
              </div>
            )}
            {nftLoadMoreError && !nftLoadingMore && (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm mb-3">{nftLoadMoreError}</p>
                <button
                  onClick={() => {
                    setNftLoadMoreError(null);
                    setNftPage((currentPage) => {
                      const nextPage = currentPage + 1;
                      fetchRecentNFTs(nextPage, true);
                      return nextPage;
                    });
                  }}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {!nftHasMore && nftListings.length > 0 && !nftLoadingMore && !nftLoadMoreError && (
              <div className="text-center py-8">
                <p className="text-[#666666] text-xs">No more NFTs to load</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Recent Editions */}
      <section id="editions" className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono">
            Recent Editions
          </h2>
          <div className="flex items-center gap-3">
            {editionListings.length > 0 && (
              <TransitionLink
                href="/market?tab=recent"
                prefetch={false}
                className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
              >
                View All →
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

        {editionLoading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading editions...</p>
          </div>
        ) : editionError ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error loading editions</p>
            <p className="text-[#999999] text-sm mb-4">{editionError}</p>
            <button
              onClick={() => {
                setEditionListings([]);
                setEditionPage(0);
                fetchRecentEditions(0, false);
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : editionListings.length === 0 ? (
          <div className="text-center py-12">
            {editionSubgraphDown ? (
              <>
                <p className="text-[#cccccc] mb-2">Unable to load editions</p>
                <p className="text-[#999999] text-sm mb-4">The data service is temporarily unavailable. Please check back later.</p>
                <button
                  onClick={() => {
                    setEditionSubgraphDown(false);
                    fetchRecentEditions(0, false);
                  }}
                  className="text-white hover:underline text-sm"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-[#cccccc] mb-4">No editions found</p>
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
              <RecentListingsTable listings={editionListings} loading={false} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editionListings.map((auction, index) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    gradient={gradients[index % gradients.length]}
                    index={index}
                  />
                ))}
              </div>
            )}
            <div ref={editionLoadMoreRef} className="h-1" />
            {editionLoadingMore && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#cccccc] text-sm">Loading more editions...</p>
                </div>
              </div>
            )}
            {editionLoadMoreError && !editionLoadingMore && (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm mb-3">{editionLoadMoreError}</p>
                <button
                  onClick={() => {
                    setEditionLoadMoreError(null);
                    setEditionPage((currentPage) => {
                      const nextPage = currentPage + 1;
                      fetchRecentEditions(nextPage, true);
                      return nextPage;
                    });
                  }}
                  className="px-4 py-1.5 text-sm text-white border border-[#666666] hover:border-white transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {!editionHasMore && editionListings.length > 0 && !editionLoadingMore && !editionLoadMoreError && (
              <div className="text-center py-8">
                <p className="text-[#666666] text-xs">No more editions to load</p>
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

