"use client";

import { useState, useEffect } from "react";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { Logo } from "~/components/Logo";
import { RecentListingsTable } from "~/components/RecentListingsTable";
import { AdminToolsPanel } from "~/components/AdminToolsPanel";
import { FeaturedSections } from "~/components/FeaturedSections";
import { FeaturedCarousel } from "~/components/FeaturedCarousel";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useMiniApp } from "@neynar/react";
import { useAuthMode } from "~/hooks/useAuthMode";
import type { EnrichedAuctionData } from "~/lib/types";
import Image from "next/image";


interface HomePageClientProps {
  initialAuctions?: EnrichedAuctionData[];
}

export default function HomePageClient({ initialAuctions = [] }: HomePageClientProps) {
  const [auctions, setAuctions] = useState<EnrichedAuctionData[]>(initialAuctions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const { actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;

  // Fetch all recent listings chronologically
  const fetchRecentListings = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[HomePageClient] Fetching recent listings...');
      // Fetch all recent listings ordered by creation date (newest first)
      const response = await fetch('/api/listings/browse?first=20&skip=0&orderBy=createdAt&orderDirection=desc&enrich=true');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const recentListings = data.listings || [];
      console.log('[HomePageClient] Received listings:', recentListings.length);
      setAuctions(recentListings);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch listings';
      console.error('[HomePageClient] Error fetching listings:', errorMessage, error);
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
  useEffect(() => {
    // If we have initial auctions from server, use them (they're cached server-side)
    // Only fetch if we don't have any initial data
    if (initialAuctions.length === 0) {
      fetchRecentListings();
    } else {
      // We have initial data from server, use it
      setAuctions(initialAuctions);
    }
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

      {/* Create Listing Button - Minimal */}
      {isPro && (
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

      {/* Manual Featured Listings (Priority - Always Top) */}
      <FeaturedCarousel />

      {/* Featured Sections (Dynamic Sections) */}
      <FeaturedSections />

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

      {/* Recent Listings */}
      <section id="listings" className="px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] font-mek-mono">
            Recent Listings
          </h2>
          {auctions.length > 0 && (
            <TransitionLink
              href="/market?tab=recent"
              prefetch={false}
              className="text-xs text-[#999999] hover:text-white transition-colors font-mek-mono tracking-[0.5px]"
            >
              View All Recent →
            </TransitionLink>
          )}
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
                fetchRecentListings();
              }}
              className="text-white hover:underline"
            >
              Retry
            </button>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc] mb-4">No listings found</p>
            {isPro && (
              <TransitionLink
                href="/create"
                prefetch={false}
                className="text-white hover:underline"
              >
                Create your first listing
              </TransitionLink>
            )}
          </div>
        ) : (
          <RecentListingsTable listings={auctions} />
        )}
      </section>

      {/* Admin Tools Panel - Only visible when admin mode is enabled */}
      <AdminToolsPanel />
    </div>
  );
}

