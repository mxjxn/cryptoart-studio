"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { AuctionCard } from "~/components/AuctionCard";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import type { EnrichedAuctionData } from "~/lib/types";
import { getActiveAuctions } from "~/lib/subgraph";
import Image from "next/image";

// Gradient colors for artwork placeholders
const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

interface HomePageClientProps {
  initialAuctions?: EnrichedAuctionData[];
}

export default function HomePageClient({ initialAuctions = [] }: HomePageClientProps) {
  const router = useRouter();
  const [auctions, setAuctions] = useState<EnrichedAuctionData[]>(initialAuctions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyConcluded, setRecentlyConcluded] = useState<EnrichedAuctionData[]>([]);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;

  // Fetch auctions function (reusable for initial load and retry)
  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[HomePageClient] Fetching auctions...');
      // Use cached data from server (cache: true is default)
      // Server-side cache is 15 minutes, which reduces subgraph rate limiting
      const cachedAuctions = await getActiveAuctions({ 
        first: 16, 
        skip: 0, 
        enrich: true,
        cache: true // Use server-side cache to avoid rate limiting
      });
      console.log('[HomePageClient] Received auctions:', cachedAuctions?.length || 0);
      setAuctions(cachedAuctions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch auctions';
      console.error('[HomePageClient] Error fetching auctions:', errorMessage, error);
      setError(errorMessage);
      // Keep using initialAuctions on error
      setAuctions(initialAuctions);
    } finally {
      console.log('[HomePageClient] Setting loading to false');
      setLoading(false);
    }
  };

  // Use server-side cached data initially
  // Only refetch if we don't have initial data (e.g., after navigation)
  // This reduces subgraph load - cache is managed server-side and revalidated every 15 minutes
  useEffect(() => {
    // If we have initial auctions from server, use them (they're cached server-side)
    // Only fetch if we don't have any initial data
    if (initialAuctions.length === 0) {
      fetchAuctions();
    } else {
      // We have initial data from server, use it
      setAuctions(initialAuctions);
    }

    // Fetch additional homepage data
    async function fetchHomepageData() {
      try {
        // Recently concluded
        const concludedRes = await fetch('/api/listings/recently-concluded?first=8&enrich=true');
        if (concludedRes.ok) {
          const concludedData = await concludedRes.json();
          setRecentlyConcluded(concludedData.listings || []);
        }
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      }
    }

    fetchHomepageData();
  }, []); // Empty deps - only run on mount

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
        <Logo />
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-[#333333]">
        <div className="px-5 py-0 flex items-center flex-col text-center justify-around">
          <h1 className="text-[24px] font-light leading-tight mb-3 font-mek-mono inline-block">
            v1 Auctionhouse & Marketplace
          </h1>
          <p></p>
          {isPro && (
            <div className="flex justify-center">
              <div className="w-[80vw]">
                <TransitionLink
                  href="/create"
                  className="block w-full px-8 py-3.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors text-center"
                >
                  List an Artwork
                </TransitionLink>
              </div>
            </div>
          )}
        </div>
      </section>

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
      {!membershipLoading && !isPro && (
        <section className="border-b border-[#333333] bg-[#0a0a0a]">
          <div className="px-5 py-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="text-[13px] uppercase tracking-[1.5px] text-[#666666] font-mek-mono">
                Creator Access
              </div>
              <div className="text-sm font-normal text-[#cccccc]">
                Mint to create your own auctions
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-base font-normal text-white">only 0.0001 ETH/month</div>
              <TransitionLink
                href="/membership"
                className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors whitespace-nowrap"
              >
                Mint Pass
              </TransitionLink>
            </div>
          </div>
        </section>
      )}

      {/* Active Listings */}
      <section id="listings" className="px-5 py-8">
        <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] mb-6 font-mek-mono">
          Active Listings
        </h2>

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
                fetchAuctions();
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc] mb-4">No active listings found</p>
            {isPro && (
              <TransitionLink
                href="/create"
                className="text-white hover:underline"
              >
                Create your first listing
              </TransitionLink>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {auctions.map((auction, index) => (
              <AuctionCard
                key={auction.listingId}
                auction={auction}
                gradient={gradients[index % gradients.length]}
                index={index}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recently Concluded */}
      {recentlyConcluded.length > 0 && (
        <section className="px-5 py-8 border-t border-[#333333]">
          <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
            Recently Concluded
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentlyConcluded.map((listing, index) => (
              <AuctionCard
                key={listing.listingId}
                auction={listing}
                gradient={gradients[index % gradients.length]}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

