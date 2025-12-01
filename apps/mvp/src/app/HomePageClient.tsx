"use client";

import Link from "next/link";
import { useActiveAuctions } from "~/hooks/useActiveAuctions";
import { formatEther } from "viem";
import { ProfileDropdown } from "~/components/ProfileDropdown";

// Gradient colors for artwork placeholders
const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

export default function HomePageClient() {
  const { auctions, loading } = useActiveAuctions();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
        <div className="text-base font-normal tracking-[0.5px]">cryptoart.social</div>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
          >
            Create Auction
          </Link>
          <ProfileDropdown />
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-[#333333]">
        <div className="px-5 py-12">
          <div className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-4">
            Farcaster Native
          </div>
          <h1 className="text-[32px] font-light leading-tight mb-3">
            Auctionhouse
          </h1>
          <p className="text-sm text-[#cccccc] mb-8 leading-relaxed">
            Create and bid on NFT auctions directly from Farcaster. Built for the decentralized social web.
          </p>
          <Link
            href="/create"
            className="inline-block px-8 py-3.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
          >
            Create Auction
          </Link>
        </div>
      </section>

      {/* Membership Banner */}
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

      {/* Active Auctions */}
      <section className="px-5 py-8">
        <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
          Active Auctions
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc]">Loading auctions...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#cccccc] mb-4">No active auctions found</p>
            <Link
              href="/create"
              className="text-white hover:underline"
            >
              Create your first auction
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {auctions.map((auction, index) => {
              const gradient = gradients[index % gradients.length];
              const currentPrice = auction.highestBid?.amount
                ? formatEther(BigInt(auction.highestBid.amount))
                : formatEther(BigInt(auction.initialAmount || "0"));
              
              const title = auction.title || `Auction #${auction.listingId}`;
              const artist = auction.artist || 'Unknown Artist';
              const bidCount = auction.bidCount || 0;
              
              return (
                <Link
                  key={auction.id}
                  href={`/auction/${auction.listingId}`}
                  className="relative w-full cursor-pointer transition-opacity hover:opacity-90"
                >
                  <div 
                    className="w-full h-[280px] relative overflow-hidden"
                    style={{ 
                      background: auction.image 
                        ? `url(${auction.image}) center/cover` 
                        : gradient 
                    }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
                      <div className="text-lg font-normal mb-1 line-clamp-1">
                        {title}
                      </div>
                      <div className="text-xs text-[#cccccc] mb-2">
                        {artist}
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-[#999999]">
                          {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
                        </div>
                        <div className="text-base font-medium flex items-baseline gap-1">
                          <span className="text-[10px] uppercase tracking-[1px] text-[#999999]">
                            {auction.highestBid ? 'High' : 'Reserve'}
                          </span>
                          <span>{currentPrice} ETH</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

