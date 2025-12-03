"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TransitionLink } from "~/components/TransitionLink";
import { ProfileDropdown } from "~/components/ProfileDropdown";
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
  const [recentlyConcluded, setRecentlyConcluded] = useState<EnrichedAuctionData[]>([]);
  const [recentArtists, setRecentArtists] = useState<Array<{ address: string; username: string | null; displayName: string | null; pfpUrl: string | null }>>([]);
  const [recentBidders, setRecentBidders] = useState<Array<{ address: string; username: string | null; displayName: string | null; pfpUrl: string | null }>>([]);
  const [recentCollectors, setRecentCollectors] = useState<Array<{ address: string; username: string | null; displayName: string | null; pfpUrl: string | null }>>([]);
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const { actions, added } = useMiniApp();
  const { isMiniApp } = useAuthMode();

  // Refetch auctions when component mounts
  // This ensures fresh data after navigation from cancel/finalize actions
  useEffect(() => {
    async function fetchFreshAuctions() {
      setLoading(true);
      try {
        const freshAuctions = await getActiveAuctions({ 
          first: 16, 
          skip: 0, 
          enrich: true,
          cache: false // Bypass cache to get fresh data
        });
        setAuctions(freshAuctions);
      } catch (error) {
        console.error('Error fetching fresh auctions:', error);
        // Keep using initialAuctions on error
        setAuctions(initialAuctions);
      } finally {
        setLoading(false);
      }
    }

    // Always refetch on mount to ensure we have the latest data
    // This is especially important after cancel/finalize actions
    fetchFreshAuctions();

    // Fetch additional homepage data
    async function fetchHomepageData() {
      try {
        // Recently concluded
        const concludedRes = await fetch('/api/listings/recently-concluded?first=8&enrich=true');
        if (concludedRes.ok) {
          const concludedData = await concludedRes.json();
          setRecentlyConcluded(concludedData.listings || []);
        }

        // Recent artists
        const artistsRes = await fetch('/api/users/recent-artists?first=6');
        if (artistsRes.ok) {
          const artistsData = await artistsRes.json();
          setRecentArtists(artistsData.artists || []);
        }

        // Recent bidders
        const biddersRes = await fetch('/api/users/recent-bidders?first=6');
        if (biddersRes.ok) {
          const biddersData = await biddersRes.json();
          setRecentBidders(biddersData.bidders || []);
        }

        // Recent collectors
        const collectorsRes = await fetch('/api/users/recent-collectors?first=6');
        if (collectorsRes.ok) {
          const collectorsData = await collectorsRes.json();
          setRecentCollectors(collectorsData.collectors || []);
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
      <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
        <Link href="/" className="font-normal tracking-[0.5px] hover:opacity-80 transition-opacity font-mek-mono text-[15px]">
          cryptoart.social
        </Link>
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-[#333333]">
        <div className="px-5 py-6">
          <div className="text-[16px] uppercase tracking-[2px] text-[#999999] mb-0 font-mek-mono">cryptoart.social v1</div>
          <h1 className="text-[24px] font-light leading-tight mb-3">
            Auctionhouse & Marketplace
          </h1>
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
      {isMiniApp && !added && actions && (
        <section className="border-b border-[#333333]">
          <div className="px-5 py-3 flex justify-end">
            <button
              onClick={actions.addMiniApp}
              className="text-[16px] font-mek-mono text-[#999999] hover:text-[#cccccc] transition-colors underline"
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
              <div className="text-[10px] uppercase tracking-[1.5px] text-[#666666]">
                Creator Access
              </div>
              <div className="text-sm font-normal text-[#cccccc]">
                Mint to create your own auctions
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-base font-normal text-white">0.5 ETH</div>
              <Link
                href="/membership"
                className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors whitespace-nowrap"
              >
                Mint Pass
              </Link>
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

      {/* Recent Artists */}
      {recentArtists.length > 0 && (
        <section className="px-5 py-8 border-t border-[#333333]">
          <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
            Recent Artists
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentArtists.map((artist) => (
              <Link
                key={artist.address}
                href={artist.username ? `/user/${artist.username}` : `/user/${artist.address}`}
                className="flex flex-col items-center gap-2 min-w-[80px]"
              >
                {artist.pfpUrl ? (
                  <img
                    src={artist.pfpUrl}
                    alt={artist.displayName || artist.username || artist.address}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
                )}
                <p className="text-xs text-center text-[#cccccc] line-clamp-1">
                  {artist.displayName || artist.username || `${artist.address.slice(0, 6)}...${artist.address.slice(-4)}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Bidders */}
      {recentBidders.length > 0 && (
        <section className="px-5 py-8 border-t border-[#333333]">
          <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
            Recent Bidders
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentBidders.map((bidder) => (
              <Link
                key={bidder.address}
                href={bidder.username ? `/user/${bidder.username}` : `/user/${bidder.address}`}
                className="flex flex-col items-center gap-2 min-w-[80px]"
              >
                {bidder.pfpUrl ? (
                  <img
                    src={bidder.pfpUrl}
                    alt={bidder.displayName || bidder.username || bidder.address}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
                )}
                <p className="text-xs text-center text-[#cccccc] line-clamp-1">
                  {bidder.displayName || bidder.username || `${bidder.address.slice(0, 6)}...${bidder.address.slice(-4)}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Collectors */}
      {recentCollectors.length > 0 && (
        <section className="px-5 py-8 border-t border-[#333333]">
          <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
            Recent Collectors
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recentCollectors.map((collector) => (
              <Link
                key={collector.address}
                href={collector.username ? `/user/${collector.username}` : `/user/${collector.address}`}
                className="flex flex-col items-center gap-2 min-w-[80px]"
              >
                {collector.pfpUrl ? (
                  <img
                    src={collector.pfpUrl}
                    alt={collector.displayName || collector.username || collector.address}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
                )}
                <p className="text-xs text-center text-[#cccccc] line-clamp-1">
                  {collector.displayName || collector.username || `${collector.address.slice(0, 6)}...${collector.address.slice(-4)}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

