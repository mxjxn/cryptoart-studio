"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import { TransitionLink } from "~/components/TransitionLink";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { useUsername } from "~/hooks/useUsername";
import { CopyButton } from "~/components/CopyButton";
// import { FavoriteButton } from "~/components/FavoriteButton";
import { ListingChips } from "~/components/ListingChips";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";
import { getAuctionTimeStatus, getFixedPriceTimeStatus } from "~/lib/time-utils";
import { useLoadingOverlay } from "~/contexts/LoadingOverlayContext";
import { getAuction } from "~/lib/subgraph";

interface AuctionCardProps {
  auction: EnrichedAuctionData;
  gradient: string;
  index: number;
}

export function AuctionCard({ auction, gradient, index }: AuctionCardProps) {
  const router = useRouter();
  const { showOverlay } = useLoadingOverlay();
  const cardRef = useRef<HTMLDivElement>(null);
  // Fetch ERC20 token info if not ETH
  const erc20Token = useERC20Token(!isETH(auction.erc20) ? auction.erc20 : undefined);
  
  // Determine token symbol (use fetched symbol or fall back to "$TOKEN")
  const tokenSymbol = isETH(auction.erc20) 
    ? "ETH" 
    : erc20Token.isValid && erc20Token.symbol 
      ? erc20Token.symbol 
      : "$TOKEN";
  
  // Determine decimals for formatting (ETH uses 18, use token's decimals otherwise)
  const tokenDecimals = isETH(auction.erc20) ? 18 : (erc20Token.decimals || 18);
  
  // Format price based on token decimals
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** tokenDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    let fractionalStr = fractionalPart.toString().padStart(tokenDecimals, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 4) {
      fractionalStr = fractionalStr.slice(0, 4);
    }
    
    return `${wholePart}.${fractionalStr}`;
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
  
  let timeStatusDisplay: React.ReactElement | null = null;
  
  if (auction.listingType === "INDIVIDUAL_AUCTION") {
    const timeStatus = getAuctionTimeStatus(startTime, endTime, hasBid);
    if (timeStatus.status === "Not started") {
      timeStatusDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          Not started
        </div>
      );
    } else if (timeStatus.endDate && timeStatus.timeRemaining) {
      timeStatusDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          <div>ends {timeStatus.endDate}</div>
          <div>{timeStatus.timeRemaining}</div>
        </div>
      );
    }
  } else if (auction.listingType === "FIXED_PRICE") {
    const timeStatus = getFixedPriceTimeStatus(endTime);
    if (!timeStatus.neverExpires && timeStatus.endDate && timeStatus.timeRemaining) {
      timeStatusDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          <div>ends {timeStatus.endDate}</div>
          <div>{timeStatus.timeRemaining}</div>
        </div>
      );
    }
  }


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
  
  // Get username for linking to profile
  const { username: creatorUsername } = useUsername(addressToShow || null);

  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!cardRef.current) return;

    // Show overlay immediately
    showOverlay(auction.listingId, auction, gradient, cardRef.current);

    try {
      // Preload the listing data in the background
      // This ensures the data is ready when we navigate
      const startTime = Date.now();
      await getAuction(auction.listingId);
      const loadTime = Date.now() - startTime;

      // Ensure minimum display time for smooth animation (at least 200ms)
      const minDisplayTime = 200;
      const remainingTime = Math.max(0, minDisplayTime - loadTime);

      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      // Navigate using view transition if supported
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as any).startViewTransition(() => {
          router.push(`/listing/${auction.listingId}`);
        });
      } else {
        router.push(`/listing/${auction.listingId}`);
      }
    } catch (error) {
      console.error("Error preloading listing:", error);
      // Navigate anyway even if preload fails
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as any).startViewTransition(() => {
          router.push(`/listing/${auction.listingId}`);
        });
      } else {
        router.push(`/listing/${auction.listingId}`);
      }
    }
  };

  return (
    <div
      className="relative w-full cursor-pointer group"
      onClick={handleClick}
    >
      <div
        ref={cardRef}
        className="w-full h-[280px] relative overflow-hidden bg-black flex items-center justify-center"
        style={{
          background: auction.image
            ? undefined
            : gradient,
        }}
      >
        {auction.image && (
          <img
            src={auction.image}
            alt={title}
            className="w-full h-full object-contain"
            style={{
              objectFit: 'contain',
            }}
          />
        )}
        <ListingChips auction={auction} />
        {/* FavoriteButton hidden - will reconsider placement later */}
        {/* <div className="absolute top-2 left-2">
          <FavoriteButton listingId={auction.listingId} />
        </div> */}
        {/* Overlay with gradient and data - only visible on hover */}
        <div className="absolute bottom-0 left-0 right-0 h-[33.33%] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pointer-events-none"></div>
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 relative z-10">
            <div className="text-lg font-normal mb-1 line-clamp-1">{title}</div>
            {contractName && (
              <div className="text-xs text-[#999999] mb-1 line-clamp-1">
                {contractName}
              </div>
            )}
            {showArtist ? (
              <div className="text-xs text-[#cccccc] mb-2">
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
              <div className="text-xs text-[#cccccc] mb-2 flex items-center gap-1.5">
                <TransitionLink
                  href={creatorUsername ? `/user/${creatorUsername}` : `/user/${addressToShow}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[10px] hover:underline"
                >
                  {`${addressToShow.slice(0, 6)}...${addressToShow.slice(-4)}`}
                </TransitionLink>
                <CopyButton text={addressToShow} size="sm" />
              </div>
            ) : null}
            <div className="flex items-center justify-between mb-2">
              {auction.listingType === "INDIVIDUAL_AUCTION" && (
                <div className="text-xs text-[#999999]">
                  {bidCount} {bidCount === 1 ? "bid" : "bids"}
                </div>
              )}
              {auction.listingType === "FIXED_PRICE" && auction.tokenSpec === "ERC1155" && (
                <div className="text-xs text-[#999999]">
                  {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")}/{parseInt(auction.totalAvailable)} available
                </div>
              )}
              {auction.listingType === "OFFERS_ONLY" && (
                <div className="text-xs text-[#999999]">
                  Make offer
                </div>
              )}
              <div className="text-base font-medium flex items-baseline gap-1">
                <span className="text-[10px] uppercase tracking-[1px] text-[#999999]">
                  {priceLabel}
                </span>
                <span>{currentPrice} {currentPrice !== "—" && tokenSymbol}</span>
              </div>
            </div>
            {timeStatusDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}

