"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { User } from "lucide-react";
import type { AuctionData } from "@cryptoart/unified-indexer";

interface Auction extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
}

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

function getGradientForIndex(index: number): string {
  return gradients[index % gradients.length];
}

function formatPrice(price: string | bigint | undefined): string {
  if (!price) return "0 ETH";
  try {
    const priceStr = typeof price === "bigint" ? price.toString() : price;
    const eth = formatEther(BigInt(priceStr));
    return `${parseFloat(eth).toFixed(2)} ETH`;
  } catch {
    return "0 ETH";
  }
}

function getCurrentBid(auction: Auction): string {
  if (auction.bids && auction.bids.length > 0) {
    return formatPrice(auction.bids[0].amount);
  }
  if (auction.currentPrice) {
    return formatPrice(auction.currentPrice);
  }
  if (auction.initialAmount) {
    return formatPrice(auction.initialAmount);
  }
  return "0 ETH";
}

/**
 * HomeTab component displays the public-facing art marketplace homepage.
 * 
 * Features:
 * - Hero section with featured collection
 * - Membership banner
 * - Active auctions grid
 * - Create button (placeholder)
 */
export function HomeTab() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/auctions/active?first=12");
        const data = await response.json();
        if (data.success && data.auctions) {
          setAuctions(data.auctions);
        }
      } catch (error) {
        console.error("Error fetching auctions:", error);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAuctions();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Bar */}
      <header className="flex justify-between items-center px-5 py-4 border-b border-[#333333]">
        <div className="text-base font-normal tracking-[0.5px]">cryptoart.social</div>
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
            onClick={() => {
              // Placeholder - will wire up later
              console.log("Create clicked");
            }}
          >
            Create
          </button>
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
            <User className="w-[18px] h-[18px] text-black" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-[#333333]">
        <div className="px-5 py-12">
          <div className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-4">
            Featured Series
          </div>
          <h1 className="text-[32px] font-light leading-tight mb-3">
            Genesis Collection
          </h1>
          <p className="text-sm text-[#cccccc] mb-8 leading-relaxed">
            Exclusive digital art series from pioneering creators
          </p>
          <button className="inline-block px-8 py-3.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors">
            View Collection
          </button>
        </div>
      </section>

      {/* Membership Banner */}
      <section className="border-b border-[#333333] bg-[#0a0a0a]">
        <div className="px-5 py-5 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
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
            <button className="px-6 py-2.5 bg-white text-black text-[13px] font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors whitespace-nowrap">
              Mint Pass
            </button>
          </div>
        </div>
      </section>

      {/* Active Auctions */}
      <section className="px-5 py-8">
        <h2 className="text-[11px] uppercase tracking-[2px] text-[#999999] mb-6">
          Active Auctions
        </h2>
        {loading ? (
          <div className="text-center py-12 text-[#999999]">Loading auctions...</div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-12 text-[#999999]">No active auctions</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {auctions.map((auction, index) => (
              <div
                key={`${auction.listingId}-${index}`}
                className="relative w-full cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div
                  className="w-full h-[280px] relative overflow-hidden"
                  style={{ background: getGradientForIndex(index) }}
                >
                  <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
                    <div className="text-lg font-normal mb-1">
                      {auction.collectionName || `Auction #${auction.listingId}`}
                    </div>
                    <div className="text-xs text-[#cccccc] mb-3">
                      {auction.collectionAddress
                        ? `${auction.collectionAddress.slice(0, 6)}...${auction.collectionAddress.slice(-4)}`
                        : "Unknown Artist"}
                    </div>
                    <div className="text-base font-medium flex items-baseline gap-1">
                      <span className="text-[10px] text-[#999999] uppercase tracking-[1px]">
                        Current Bid
                      </span>
                      <span>{getCurrentBid(auction)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
