"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/card";
import type { AuctionData } from "@cryptoart/unified-indexer";
import { JoinModal } from "./JoinModal";

interface EnrichedAuction extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
  artistFid?: number;
  artistName?: string;
  artistPfp?: string;
  artistBio?: string;
  nftImage?: string;
  nftName?: string;
}

export function HeroSection() {
  const [featuredAuction, setFeaturedAuction] = useState<EnrichedAuction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [stats, setStats] = useState({
    collectors: 1247,
    artists: 89,
    volume: "2.3",
  });

  useEffect(() => {
    async function fetchFeaturedAuction() {
      try {
        setLoading(true);
        const [auctionResponse, statsResponse] = await Promise.all([
          fetch("/api/landing/featured-auction"),
          fetch("/api/landing/stats"),
        ]);
        
        const auctionData = await auctionResponse.json();
        setFeaturedAuction(auctionData.auction);
        
        const statsData = await statsResponse.json();
        if (statsData.collectors || statsData.artists || statsData.volumeFormatted) {
          setStats({
            collectors: statsData.collectors || 0,
            artists: statsData.artists || 0,
            volume: statsData.volumeFormatted || "0",
          });
        }
      } catch (error) {
        console.error("Error fetching featured auction:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedAuction();
  }, []);

  const getTimeRemaining = (endTime: string) => {
    const end = parseInt(endTime) * 1000;
    const now = Date.now();
    if (end <= now) return "Ended";
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-gray-500">Loading featured auction...</div>
      </div>
    );
  }

  if (!featuredAuction) {
    return (
      <div className="h-[60vh] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No featured auction</h2>
          <p className="text-gray-500">Check back soon for featured art</p>
        </div>
      </div>
    );
  }

  const currentBid = featuredAuction.currentPrice
    ? formatEther(BigInt(featuredAuction.currentPrice))
    : null;
  const reserve = formatEther(BigInt(featuredAuction.initialAmount));

  return (
    <>
      <div className="min-h-[60vh] grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side - Featured Auction (60%) */}
        <div className="lg:col-span-3">
          <Card className="h-full overflow-hidden">
            <div className="h-full grid grid-cols-1 md:grid-cols-2">
              <div className="aspect-square md:aspect-auto bg-gray-100 relative">
                {featuredAuction.nftImage ? (
                  <img
                    src={featuredAuction.nftImage}
                    alt={featuredAuction.nftName || "Featured NFT"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <CardContent className="p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {featuredAuction.nftName || featuredAuction.collectionName || "Untitled"}
                    </h2>
                    {featuredAuction.artistName && (
                      <p className="text-gray-600 mt-1">by {featuredAuction.artistName}</p>
                    )}
                    {featuredAuction.artistBio && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {featuredAuction.artistBio}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Current Bid</p>
                      <p className="text-2xl font-bold">
                        {currentBid ? `${currentBid} ETH` : `Reserve: ${reserve} ETH`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Time Remaining</p>
                      <p className="text-lg font-semibold">
                        {getTimeRemaining(featuredAuction.endTime)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    onClick={() => {
                      window.location.href = `/auction/${featuredAuction.listingId}`;
                    }}
                    className="w-full max-w-none"
                  >
                    Bid Now
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Right Side - Value Prop (40%) */}
        <div className="lg:col-span-2 flex flex-col justify-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-4">What is Cryptoart Social?</h1>
            <div className="space-y-3 text-gray-700">
              <p>Discover emerging artists through community curation</p>
              <p>Build your collection and earn recognition</p>
              <p>Create curated galleries that other collectors follow</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Community Stats</p>
            <div className="text-2xl font-bold">
              {stats.collectors.toLocaleString()} collectors |{" "}
              {stats.artists} artists |{" "}
              {stats.volume} ETH volume
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setShowJoinModal(true)}
              className="w-full max-w-none"
              variant="primary"
            >
              Join for Free
            </Button>
            <Button
              onClick={() => {
                window.location.href = "/studio";
              }}
              className="w-full max-w-none"
              variant="outline"
            >
              Create Auction
            </Button>
          </div>
        </div>
      </div>

      {showJoinModal && (
        <JoinModal onClose={() => setShowJoinModal(false)} />
      )}
    </>
  );
}

