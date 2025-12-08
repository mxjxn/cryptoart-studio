"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransitionLink } from "~/components/TransitionLink";
import { useArtistName } from "~/hooks/useArtistName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { useUsername } from "~/hooks/useUsername";
import { getAuctionTimeStatus, getFixedPriceTimeStatus } from "~/lib/time-utils";
import { getAuction } from "~/lib/subgraph";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";

interface RecentListingsTableProps {
  listings: EnrichedAuctionData[];
  loading?: boolean;
}

export function RecentListingsTable({ listings, loading = false }: RecentListingsTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[#cccccc]">Loading listings...</p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#cccccc]">No listings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {listings.map((auction) => (
        <RecentListingRow key={auction.listingId} auction={auction} />
      ))}
    </div>
  );
}

interface RecentListingRowProps {
  auction: EnrichedAuctionData;
}

function RecentListingRow({ auction }: RecentListingRowProps) {
  const router = useRouter();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Fetch ERC20 token info if not ETH
  const erc20Token = useERC20Token(!isETH(auction.erc20) ? auction.erc20 : undefined);

  // Determine token symbol
  const tokenSymbol = isETH(auction.erc20)
    ? "ETH"
    : erc20Token.isValid && erc20Token.symbol
      ? erc20Token.symbol
      : "$TOKEN";

  // Determine decimals for formatting
  const tokenDecimals = isETH(auction.erc20) ? 18 : (erc20Token.decimals || 18);

  // Format price based on token decimals with commas
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** tokenDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;

    // Format whole part with commas
    const wholePartFormatted = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (fractionalPart === BigInt(0)) {
      return wholePartFormatted;
    }

    let fractionalStr = fractionalPart.toString().padStart(tokenDecimals, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 4) {
      fractionalStr = fractionalStr.slice(0, 4);
    }

    return `${wholePartFormatted}.${fractionalStr}`;
  };

  // Determine price display based on listing type
  let currentPrice: string;
  let priceLabel: string;

  if (auction.listingType === "FIXED_PRICE") {
    currentPrice = formatPrice(auction.initialAmount || "0");
    priceLabel = "Price";
  } else if (auction.listingType === "OFFERS_ONLY") {
    currentPrice = "—";
    priceLabel = "Offers";
  } else {
    // INDIVIDUAL_AUCTION
    currentPrice = auction.highestBid?.amount
      ? formatPrice(auction.highestBid.amount)
      : formatPrice(auction.initialAmount || "0");
    priceLabel = auction.highestBid ? "High" : "Reserve";
  }

  const title = auction.title || `Listing #${auction.listingId}`;
  const bidCount = auction.bidCount || 0;

  // Get time status for display
  const startTime = parseInt(auction.startTime || "0");
  const endTime = parseInt(auction.endTime || "0");
  const hasBid = bidCount > 0 || !!auction.highestBid;

  let timeStatusDisplay: string | null = null;

  if (auction.listingType === "INDIVIDUAL_AUCTION") {
    const timeStatus = getAuctionTimeStatus(startTime, endTime, hasBid);
    if (timeStatus.status === "Not started") {
      timeStatusDisplay = "Not started";
    } else if (!timeStatus.neverExpires && timeStatus.timeRemaining) {
      timeStatusDisplay = timeStatus.timeRemaining;
    }
  } else if (auction.listingType === "FIXED_PRICE") {
    const timeStatus = getFixedPriceTimeStatus(endTime);
    if (!timeStatus.neverExpires && timeStatus.timeRemaining) {
      timeStatusDisplay = timeStatus.timeRemaining;
    }
  }

  // Resolve artist name
  const { artistName, isLoading: artistNameLoading, creatorAddress } = useArtistName(
    auction.seller && !auction.artist ? auction.seller : null,
    auction.tokenAddress || undefined,
    auction.tokenId ? BigInt(auction.tokenId) : undefined
  );

  // Determine what to show for artist
  const displayArtist = auction.artist || artistName;
  const showArtist = displayArtist && !artistNameLoading;
  const addressToShow = creatorAddress || auction.seller;

  // Get username for linking to profile
  const { username: creatorUsername } = useUsername(addressToShow || null);

  // Fetch thumbnail
  useEffect(() => {
    const imageUrl = auction.thumbnailUrl || auction.image;
    if (!imageUrl) {
      setThumbnailUrl(null);
      return;
    }

    // Use thumbnail API for small thumbnails
    fetch(`/api/thumbnails?imageUrl=${encodeURIComponent(imageUrl)}&size=small`)
      .then((res) => res.json())
      .then((data) => {
        setThumbnailUrl(data.thumbnailUrl || imageUrl);
      })
      .catch(() => {
        setThumbnailUrl(imageUrl); // Fallback to original
      });
  }, [auction.thumbnailUrl, auction.image]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Preload the listing data in the background (non-blocking)
    getAuction(auction.listingId).catch((error) => {
      console.error("Error preloading listing:", error);
    });

    // Navigate immediately using view transition if supported
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        router.push(`/listing/${auction.listingId}`);
      });
    } else {
      router.push(`/listing/${auction.listingId}`);
    }
  };

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b border-[#333333] hover:bg-[#1a1a1a] cursor-pointer transition-colors"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 bg-[#1a1a1a] rounded overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" />
        )}
      </div>

      {/* Title and Artist */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-normal line-clamp-1 mb-1">{title}</div>
        {showArtist ? (
          <div className="text-xs text-[#999999] line-clamp-1">
            by{" "}
            {creatorUsername ? (
              <TransitionLink
                href={`/user/${creatorUsername}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {displayArtist}
              </TransitionLink>
            ) : addressToShow ? (
              <TransitionLink
                href={`/user/${addressToShow}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
              >
                {displayArtist}
              </TransitionLink>
            ) : (
              displayArtist
            )}
          </div>
        ) : addressToShow && !artistNameLoading ? (
          <div className="text-xs text-[#999999] font-mono">
            {`${addressToShow.slice(0, 6)}...${addressToShow.slice(-4)}`}
          </div>
        ) : null}
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-medium">
          {currentPrice !== "—" && (
            <>
              {currentPrice} {tokenSymbol}
            </>
          )}
          {currentPrice === "—" && "—"}
        </div>
        <div className="text-xs text-[#999999] uppercase tracking-[0.5px]">
          {priceLabel}
        </div>
      </div>

      {/* Bid Count / Time */}
      <div className="flex-shrink-0 text-right w-32">
        {auction.listingType === "INDIVIDUAL_AUCTION" && (
          <div className="text-xs text-[#999999]">
            {bidCount} {bidCount === 1 ? "bid" : "bids"}
          </div>
        )}
        {timeStatusDisplay && (
          <div className="text-xs text-[#999999] mt-1">{timeStatusDisplay}</div>
        )}
      </div>
    </div>
  );
}

