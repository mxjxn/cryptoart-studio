"use client";

import { formatEther } from "viem";
import { Card, CardContent } from "~/components/ui/card";
import type { AuctionData } from "@cryptoart/unified-indexer";

interface EnrichedAuction extends AuctionData {
  collectionName?: string;
  collectionAddress?: string;
  artistFid?: number;
  artistName?: string;
  artistPfp?: string;
  nftImage?: string;
  nftName?: string;
}

interface AuctionCardProps {
  auction: EnrichedAuction;
  onClick?: () => void;
}

export function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const getTimeRemaining = (endTime: string) => {
    const end = parseInt(endTime) * 1000;
    const now = Date.now();
    if (end <= now) return "Ended";
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const currentBid = auction.currentPrice 
    ? formatEther(BigInt(auction.currentPrice))
    : null;
  const reserve = formatEther(BigInt(auction.initialAmount));

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
      onClick={onClick}
    >
      <div className="aspect-square bg-gray-100 relative">
        {auction.nftImage ? (
          <img
            src={auction.nftImage}
            alt={auction.nftName || "NFT"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {getTimeRemaining(auction.endTime)}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold text-sm truncate">
              {auction.nftName || auction.collectionName || "Untitled"}
            </h3>
            {auction.artistName && (
              <p className="text-xs text-gray-500 truncate">
                by {auction.artistName}
              </p>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-gray-500">Current Bid</p>
              <p className="font-semibold">
                {currentBid ? `${currentBid} ETH` : `Reserve: ${reserve} ETH`}
              </p>
            </div>
            {auction.currentPrice && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Winning Bidder</p>
                <p className="text-xs font-medium truncate max-w-[100px]">
                  {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

