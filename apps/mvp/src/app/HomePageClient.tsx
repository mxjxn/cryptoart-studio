"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
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
  const [nftError, setNftError] = useState<string | null>(null);
  const [nftSubgraphDown, setNftSubgraphDown] = useState(false);
  const nftLoadingRef = useRef(true);
  const nftHasInitializedRef = useRef(false);

  // Recent Editions (ERC1155) state
  const [editionListings, setEditionListings] = useState<EnrichedAuctionData[]>([]);
  const [editionLoading, setEditionLoading] = useState(true);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [editionSubgraphDown, setEditionSubgraphDown] = useState(false);
  const editionLoadingRef = useRef(true);
  const editionHasInitializedRef = useRef(false);

  const pageSize = 6; // Show 6 listings per section on homepage
  const displayCount = 6; // Display exactly 6 items
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { isConnected } = useEffectiveAddress();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
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

  // Fetch recent NFTs (ERC721) - homepage only shows 6
  const fetchRecentNFTs = useCallback(async () => {
    setNftLoading(true);
    nftLoadingRef.current = true;
    setNftError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC721 after filtering
      console.log('[HomePageClient] Fetching recent NFTs...', { fetchCount });
      const startTime = Date.now();
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true`);
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
      
      // Take only 6 for display
      setNftListings(nftListings.slice(0, displayCount));
      setNftSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NFTs';
      console.error('[HomePageClient] Error fetching NFTs:', errorMessage, error);
      setNftError(errorMessage);
    } finally {
      setNftLoading(false);
      nftLoadingRef.current = false;
    }
  }, [displayCount]);

  // Fetch recent Editions (ERC1155) - homepage only shows 6
  const fetchRecentEditions = useCallback(async () => {
    setEditionLoading(true);
    editionLoadingRef.current = true;
    setEditionError(null);
    try {
      // Fetch more than needed to account for filtering
      const fetchCount = 20; // Fetch 20 to ensure we get enough ERC1155 after filtering
      console.log('[HomePageClient] Fetching recent Editions...', { fetchCount });
      const startTime = Date.now();
      const response = await fetch(`/api/listings/browse?first=${fetchCount}&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true`);
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
      
      // Take only 6 for display
      setEditionListings(editionListings.slice(0, displayCount));
      setEditionSubgraphDown(isSubgraphDown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Editions';
      console.error('[HomePageClient] Error fetching Editions:', errorMessage, error);
      setEditionError(errorMessage);
    } finally {
      setEditionLoading(false);
      editionLoadingRef.current = false;
    }
  }, [displayCount]);

  // Initialize NFTs section
  useEffect(() => {
    if (nftHasInitializedRef.current) return;
    nftHasInitializedRef.current = true;
    fetchRecentNFTs();
  }, [fetchRecentNFTs]);

  // Initialize Editions section
  useEffect(() => {
    if (editionHasInitializedRef.current) return;
    editionHasInitializedRef.current = true;
    fetchRecentEditions();
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
          <TransitionLink
            href="/market?tab=recent"
            prefetch={false}
            className="text-[13px] uppercase tracking-[2px] text-[#999999] hover:text-white transition-colors font-mek-mono cursor-pointer"
          >
            Recent NFTs
          </TransitionLink>
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
                fetchRecentNFTs();
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
                    fetchRecentNFTs();
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
          <div className="grid grid-cols-3 gap-4">
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
      </section>

      {/* Recent Editions */}
      <section id="editions" className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <TransitionLink
            href="/market?tab=recent"
            prefetch={false}
            className="text-[13px] uppercase tracking-[2px] text-[#999999] hover:text-white transition-colors font-mek-mono cursor-pointer"
          >
            Recent Editions
          </TransitionLink>
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
                fetchRecentEditions();
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
                    fetchRecentEditions();
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
          <div className="grid grid-cols-3 gap-4">
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
      </section>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />
    </div>
  );
}

