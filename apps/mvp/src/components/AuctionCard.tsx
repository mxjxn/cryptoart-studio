"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { useUsername } from "~/hooks/useUsername";
import { CopyButton } from "~/components/CopyButton";
// import { FavoriteButton } from "~/components/FavoriteButton";
import { ListingChips } from "~/components/ListingChips";
import { AdminContextMenu } from "~/components/AdminContextMenu";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring, isLongTermSale } from "~/lib/time-utils";
import { getAuction } from "~/lib/subgraph";

interface AuctionCardProps {
  auction: EnrichedAuctionData;
  gradient: string;
  index: number;
  referralAddress?: string | null;
}

export function AuctionCard({ auction, gradient, index, referralAddress }: AuctionCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  // Reset image state when image URL changes
  useEffect(() => {
    if (auction.thumbnailUrl || auction.image) {
      setImageError(false);
      setImageLoading(true);
    }
  }, [auction.thumbnailUrl, auction.image]);
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
  
  // Format price based on token decimals with commas
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** tokenDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    // Format whole part with commas
    const wholePartFormatted = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
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
  
  // Resolve artist name (moved up to be available for hooks)
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
  
  // Get buyer username for finalized auctions (must be declared before use in stateDisplay)
  const buyerAddress = auction.highestBid?.bidder;
  const { username: buyerUsername } = useUsername(buyerAddress || null);
  
  // Get time status for display
  const startTime = parseInt(auction.startTime || "0");
  const endTime = parseInt(auction.endTime || "0");
  const hasBid = bidCount > 0 || !!auction.highestBid;
  const now = Math.floor(Date.now() / 1000);
  const isEnded = endTime <= now && !isNeverExpiring(endTime);
  const isFinalized = auction.status === "FINALIZED";
  const isCancelled = auction.status === "CANCELLED";
  const isERC1155 = auction.tokenSpec === "ERC1155" || String(auction.tokenSpec) === "2";
  
  // Calculate ERC1155 supply info
  let supplyDisplay: React.ReactElement | null = null;
  if (isERC1155) {
    const totalAvailable = parseInt(auction.totalAvailable || "0");
    const totalSold = parseInt(auction.totalSold || "0");
    const remaining = Math.max(0, totalAvailable - totalSold);
    const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
    
    if (isFinalized) {
      // Show sold out or how many sold
      if (remaining === 0) {
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            Sold out
          </div>
        );
      } else if (totalSold > 0) {
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            {totalSold} sold
          </div>
        );
      }
    } else {
      // Show supply prominently: "X of Y" format
      if (totalSupply !== null && totalSupply > 0) {
        const forSale = remaining;
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            {forSale} of {totalSupply} for sale
          </div>
        );
      } else if (totalAvailable > 0) {
        // Fallback to totalAvailable if totalSupply not available
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            {remaining} of {totalAvailable} available
          </div>
        );
      }
    }
  }
  
  let timeStatusDisplay: React.ReactElement | null = null;
  let stateDisplay: React.ReactElement | null = null;
  
  // Handle state display based on listing type and status
  if (isCancelled) {
    stateDisplay = (
      <div className="text-xs text-[#999999] mt-1">
        Cancelled
      </div>
    );
  } else if (isFinalized) {
    if (isERC1155) {
      // ERC1155 finalized - supply display already handled above
      stateDisplay = null;
    } else {
      // 1/1 FINALIZED: Show "Sold to [buyer] for [amount]"
      const buyer = auction.highestBid?.bidder;
      const finalPrice = auction.highestBid?.amount || auction.initialAmount || "0";
      if (buyer) {
        const buyerDisplay = buyerUsername || `${buyer.slice(0, 6)}...${buyer.slice(-4)}`;
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1">
            Sold to {buyerDisplay} for {formatPrice(finalPrice)} {tokenSymbol}
          </div>
        );
      } else {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1">
            Sold
          </div>
        );
      }
    }
  } else if (auction.listingType === "INDIVIDUAL_AUCTION") {
    const timeStatus = getAuctionTimeStatus(startTime, endTime, hasBid, now);
    if (isEnded) {
      // Auction ended but not finalized
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          Ended
        </div>
      );
    } else if (timeStatus.status === "Not started") {
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          Not started
        </div>
      );
    } else if (hasBid) {
      // Active with bids: "Current bid: [amount], [N] bids, [time remaining]"
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          <div>Current bid: {formatPrice(auction.highestBid?.amount || "0")} {tokenSymbol}</div>
          <div>{bidCount} {bidCount === 1 ? "bid" : "bids"}</div>
          {showTime && timeStatus.timeRemaining && (
            <div>{timeStatus.timeRemaining}</div>
          )}
        </div>
      );
    } else {
      // Active no bids: "Reserve: [amount], [time remaining]"
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          <div>Reserve: {formatPrice(auction.initialAmount || "0")} {tokenSymbol}</div>
          {showTime && timeStatus.timeRemaining && (
            <div>{timeStatus.timeRemaining}</div>
          )}
        </div>
      );
    }
  } else if (auction.listingType === "FIXED_PRICE") {
    const timeStatus = getFixedPriceTimeStatus(endTime, now);
    if (isERC1155) {
      // ERC1155 fixed price: Show "[X] left, [time remaining]"
      const totalAvailable = parseInt(auction.totalAvailable || "0");
      const totalSold = parseInt(auction.totalSold || "0");
      const remaining = Math.max(0, totalAvailable - totalSold);
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      
      if (remaining > 0) {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1">
            <div>{remaining} left</div>
            {showTime && timeStatus.timeRemaining && (
              <div>{timeStatus.timeRemaining}</div>
            )}
          </div>
        );
      }
    } else {
      // 1/1 fixed price
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      if (showTime && timeStatus.timeRemaining) {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1">
            <div>{timeStatus.timeRemaining}</div>
          </div>
        );
      }
    }
  }



  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks on the card itself, not on interactive children
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    
    e.preventDefault();
    
    // Preload the listing data in the background (non-blocking)
    getAuction(auction.listingId).catch((error) => {
      console.error("Error preloading listing:", error);
    });

    // Use router.push without view transition to avoid flash
    // View transitions can cause black flashes on navigation
    // Include referralAddress in URL if provided
    const listingUrl = referralAddress 
      ? `/listing/${auction.listingId}?referralAddress=${referralAddress}`
      : `/listing/${auction.listingId}`;
    router.push(listingUrl);
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
          background: (auction.thumbnailUrl || auction.image)
            ? undefined
            : gradient,
        }}
      >
        {(auction.thumbnailUrl || auction.image) && !imageError && !isCancelled ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
              </div>
            )}
            <Image
              src={(auction.thumbnailUrl || auction.image) ?? ''}
              alt={title}
              fill
              className={`object-contain transition-opacity duration-200 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              style={{
                objectFit: 'contain',
              }}
              priority={index < 6} // Prioritize first 6 images (above the fold)
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </>
        ) : null}
        <ListingChips auction={auction} />
        {/* FavoriteButton hidden - will reconsider placement later */}
        {/* <div className="absolute top-2 left-2">
          <FavoriteButton listingId={auction.listingId} />
        </div> */}
        {/* Overlay with gradient and data - only visible on hover */}
        <div className="absolute bottom-0 left-0 right-0 h-[33.33%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pointer-events-none"></div>
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 relative z-10 pointer-events-auto">
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
            {supplyDisplay}
            <div className="flex items-center justify-between mb-2">
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
            {stateDisplay}
          </div>
        </div>
      </div>
      {/* Admin Context Menu - Below the card */}
      <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
        <AdminContextMenu 
          listingId={auction.listingId} 
          sellerAddress={auction.seller}
        />
      </div>
    </div>
  );
}

