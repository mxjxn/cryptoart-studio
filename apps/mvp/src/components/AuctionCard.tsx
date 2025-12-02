"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { CopyButton } from "~/components/CopyButton";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";

interface AuctionCardProps {
  auction: EnrichedAuctionData;
  gradient: string;
  index: number;
}

export function AuctionCard({ auction, gradient, index }: AuctionCardProps) {
  const currentPrice = auction.highestBid?.amount
    ? formatEther(BigInt(auction.highestBid.amount))
    : formatEther(BigInt(auction.initialAmount || "0"));

  const title = auction.title || `Auction #${auction.listingId}`;
  const bidCount = auction.bidCount || 0;

  // Resolve artist name
  const { artistName, isLoading: artistNameLoading, creatorAddress } = useArtistName(
    auction.seller && !auction.artist ? auction.seller : null,
    auction.tokenAddress || undefined,
    auction.tokenId ? BigInt(auction.tokenId) : undefined
  );

  // Fetch contract name
  const { contractName } = useContractName(auction.tokenAddress as Address | undefined);

  // Determine what to show for artist
  const displayArtist = auction.artist || artistName;
  const showArtist = displayArtist && !artistNameLoading;
  // Use creator address if found, otherwise fall back to seller
  const addressToShow = creatorAddress || auction.seller;

  return (
    <Link
      href={`/auction/${auction.listingId}`}
      className="relative w-full cursor-pointer transition-opacity hover:opacity-90"
    >
      <div
        className="w-full h-[280px] relative overflow-hidden"
        style={{
          background: auction.image
            ? `url(${auction.image}) center/cover`
            : gradient,
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
          <div className="text-lg font-normal mb-1 line-clamp-1">{title}</div>
          {contractName && (
            <div className="text-xs text-[#999999] mb-1 line-clamp-1">
              {contractName}
            </div>
          )}
          {showArtist ? (
            <div className="text-xs text-[#cccccc] mb-2">by {displayArtist}</div>
          ) : addressToShow && !artistNameLoading ? (
            <div className="text-xs text-[#cccccc] mb-2 flex items-center gap-1.5">
              <span className="font-mono text-[10px]">
                {`${addressToShow.slice(0, 6)}...${addressToShow.slice(-4)}`}
              </span>
              <CopyButton text={addressToShow} size="sm" />
            </div>
          ) : null}
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-[#999999]">
              {bidCount} {bidCount === 1 ? "bid" : "bids"}
            </div>
            <div className="text-base font-medium flex items-baseline gap-1">
              <span className="text-[10px] uppercase tracking-[1px] text-[#999999]">
                {auction.highestBid ? "High" : "Reserve"}
              </span>
              <span>{currentPrice} ETH</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

