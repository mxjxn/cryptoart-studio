"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { useUsername } from "~/hooks/useUsername";
import { CopyButton } from "~/components/CopyButton";
import { ListingChips } from "~/components/ListingChips";
import { ListingCardMenu } from "~/components/ListingCardMenu";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring, isLongTermSale } from "~/lib/time-utils";
import { getAuction } from "~/lib/subgraph";
import type { PrerenderedListingCardData } from "~/lib/server/listing-card-prerender";

interface AuctionCardClientProps {
  listingId: string;
  staticData: PrerenderedListingCardData | null;
  auction: EnrichedAuctionData | null; // If provided, use it; otherwise fetch
  gradient: string;
  index: number;
  referralAddress?: string | null;
}

/**
 * Client component that renders listing card
 * Uses pre-rendered static data for fast initial render
 * Fetches dynamic auction data (bids, prices, status) client-side
 */
export function AuctionCardClient({
  listingId,
  staticData,
  auction: providedAuction,
  gradient,
  index,
  referralAddress,
}: AuctionCardClientProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [auction, setAuction] = useState<EnrichedAuctionData | null>(providedAuction);
  const [loadingDynamic, setLoadingDynamic] = useState(!providedAuction);
  
  // Fetch dynamic auction data if not provided
  useEffect(() => {
    if (!providedAuction && !auction) {
      setLoadingDynamic(true);
      getAuction(listingId)
        .then((data) => {
          if (data) {
            setAuction(data);
          }
        })
        .catch((error) => {
          console.error(`[AuctionCardClient] Error fetching auction ${listingId}:`, error);
        })
        .finally(() => {
          setLoadingDynamic(false);
        });
    }
  }, [listingId, providedAuction, auction]);
  
  // Reset image state when image URL changes
  useEffect(() => {
    const imageUrl = staticData?.thumbnailUrl || auction?.thumbnailUrl || auction?.image;
    if (imageUrl) {
      setImageError(false);
      setImageLoading(true);
    }
  }, [staticData?.thumbnailUrl, auction?.thumbnailUrl, auction?.image]);
  
  // Use static data for initial render, fall back to auction data
  const displayTitle = staticData?.title || auction?.title || `Listing #${listingId}`;
  const displayDescription = staticData?.description || auction?.metadata?.description || auction?.description;
  const displayArtist = staticData?.artist || auction?.artist;
  const displayImage = staticData?.thumbnailUrl || auction?.thumbnailUrl || auction?.image;
  
  // Fetch ERC20 token info if not ETH
  const erc20Token = useERC20Token(
    auction?.erc20 && !isETH(auction.erc20) ? auction.erc20 : undefined
  );
  
  // Determine token symbol
  const tokenSymbol = isETH(auction?.erc20) 
    ? "ETH" 
    : erc20Token.isValid && erc20Token.symbol 
      ? erc20Token.symbol 
      : "$TOKEN";
  
  // Determine decimals for formatting
  const tokenDecimals = isETH(auction?.erc20) ? 18 : (erc20Token.decimals || 18);
  
  // Format price based on token decimals with commas
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** tokenDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
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
  let currentPrice: string = "—";
  let priceLabel: string = "Price";
  
  if (auction) {
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
  } else if (staticData) {
    // Use static data for initial price display
    if (staticData.listingType === "FIXED_PRICE") {
      currentPrice = formatPrice(staticData.initialAmount || "0");
      priceLabel = "Price";
    } else if (staticData.listingType === "OFFERS_ONLY") {
      currentPrice = "—";
      priceLabel = "Offers";
    } else {
      currentPrice = formatPrice(staticData.initialAmount || "0");
      priceLabel = "Reserve";
    }
  }

  const bidCount = auction?.bidCount || 0;
  
  // Resolve artist name
  const { artistName, isLoading: artistNameLoading, creatorAddress } = useArtistName(
    (!displayArtist && auction?.seller) ? auction.seller : null,
    staticData?.tokenAddress || auction?.tokenAddress || undefined,
    (staticData?.tokenId || auction?.tokenId) ? BigInt(staticData?.tokenId || auction?.tokenId || "0") : undefined
  );

  // Fetch contract name
  const { contractName } = useContractName(
    (staticData?.tokenAddress || auction?.tokenAddress) as Address | undefined
  );

  // Determine what to show for artist
  const finalArtist = displayArtist || artistName;
  const showArtist = finalArtist && !artistNameLoading;
  const addressToShow = creatorAddress || staticData?.seller || auction?.seller;
  
  // Get username for linking to profile
  const { username: creatorUsername } = useUsername(addressToShow || null);
  
  // Get buyer username for finalized auctions
  const buyerAddress = auction?.highestBid?.bidder;
  const { username: buyerUsername } = useUsername(buyerAddress || null);
  
  // Get time status for display
  const startTime = auction ? parseInt(auction.startTime || "0") : 0;
  const endTime = auction ? parseInt(auction.endTime || "0") : 0;
  const hasBid = bidCount > 0 || !!auction?.highestBid;
  const now = Math.floor(Date.now() / 1000);
  const isEnded = endTime > 0 && endTime <= now && !isNeverExpiring(endTime);
  const isFinalized = auction?.status === "FINALIZED";
  const isCancelled = auction?.status === "CANCELLED";
  const isERC1155 = (staticData?.tokenSpec === "ERC1155" || staticData?.tokenSpec === "2") ||
                    (auction?.tokenSpec === "ERC1155" || String(auction?.tokenSpec) === "2");
  
  // Calculate ERC1155 supply info
  let supplyDisplay: React.ReactElement | null = null;
  if (isERC1155 && auction) {
    const totalAvailable = parseInt(auction.totalAvailable || "0");
    const totalSold = parseInt(auction.totalSold || "0");
    const remaining = Math.max(0, totalAvailable - totalSold);
    const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
    
    if (isFinalized) {
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
      if (totalSupply !== null && totalSupply > 0) {
        const forSale = remaining;
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            {forSale} of {totalSupply} for sale
          </div>
        );
      } else if (totalAvailable > 0) {
        supplyDisplay = (
          <div className="text-sm font-medium text-white mb-1">
            {remaining} of {totalAvailable} available
          </div>
        );
      }
    }
  }
  
  let stateDisplay: React.ReactElement | null = null;
  
  // Handle state display based on listing type and status
  if (isCancelled) {
    stateDisplay = (
      <div className="text-xs text-[#999999] mt-1">
        Cancelled
      </div>
    );
  } else if (isFinalized && auction) {
    if (isERC1155) {
      stateDisplay = null;
    } else {
      // Check if actually sold out (for ERC721 or FIXED_PRICE)
      const totalAvailable = parseInt(auction.totalAvailable || "1");
      const totalSold = parseInt(auction.totalSold || "0");
      const isSoldOut = totalSold >= totalAvailable && totalAvailable > 0;
      
      // For FIXED_PRICE listings, finalized doesn't mean sold - seller can finalize to reclaim unsold items
      // Only show "Sold" if actually sold out, or if it's an INDIVIDUAL_AUCTION (which means winner claimed)
      if (isSoldOut || auction.listingType === "INDIVIDUAL_AUCTION") {
        // Show "Sold to [buyer] for [amount]" if there's a buyer
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
      } else {
        // FIXED_PRICE finalized but not sold out
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1">
            Finalized
          </div>
        );
      }
    }
  } else if (auction && auction.listingType === "INDIVIDUAL_AUCTION") {
    const timeStatus = getAuctionTimeStatus(startTime, endTime, hasBid, now);
    if (isEnded) {
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
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1 leading-tight space-y-0.5">
          <div>{bidCount} {bidCount === 1 ? "bid" : "bids"}</div>
          {showTime && timeStatus.timeRemaining && (
            <div>{timeStatus.timeRemaining}</div>
          )}
        </div>
      );
    } else {
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      if (showTime && timeStatus.timeRemaining) {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1 leading-tight">
            {timeStatus.timeRemaining}
          </div>
        );
      }
    }
  } else if (auction && auction.listingType === "FIXED_PRICE") {
    // Calculate actual end time for FIXED_PRICE (same logic as auctions)
    // For startTime=0, endTime is a duration; for startTime>0, endTime is a timestamp
    let actualEndTimeForFixed: number;
    const YEAR_2000_TIMESTAMP = 946684800;
    
    if (startTime === 0) {
      // For startTime=0, endTime is a duration
      // Use heuristic: if endTime > YEAR_2000_TIMESTAMP, it's likely a timestamp
      // Otherwise, it's a duration and we can't determine if ended without creation timestamp
      if (endTime > YEAR_2000_TIMESTAMP) {
        // Looks like a timestamp, use it directly
        actualEndTimeForFixed = endTime;
      } else {
        // It's a duration, can't determine if ended without creation timestamp
        actualEndTimeForFixed = 0;
      }
    } else {
      // For startTime > 0, endTime is already a timestamp
      actualEndTimeForFixed = endTime;
    }
    
    const timeStatus = getFixedPriceTimeStatus(actualEndTimeForFixed, now);
    const totalAvailable = parseInt(auction.totalAvailable || "0");
    const totalSold = parseInt(auction.totalSold || "0");
    const remaining = Math.max(0, totalAvailable - totalSold);
    const isSoldOut = remaining === 0 && totalAvailable > 0;
    const isEndedForFixed = actualEndTimeForFixed > 0 && actualEndTimeForFixed <= now && !isNeverExpiring(actualEndTimeForFixed);
    const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
    const showTime = !isNeverExpiring(actualEndTimeForFixed) && !isLongTermSale(actualEndTimeForFixed);
    
    if (isSoldOut) {
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          Sold Out
        </div>
      );
    } else if (isEndedForFixed) {
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1">
          Sale Ended
        </div>
      );
    } else if (isERC1155) {
      if (remaining > 0) {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1 leading-tight space-y-0.5">
            <div>
              {remaining} left out of {totalAvailable}
              {totalSupply !== null && totalSupply !== totalAvailable && (
                <span className="text-[#999999]"> ({totalSupply} in total)</span>
              )}
            </div>
            {showTime && timeStatus.timeRemaining && (
              <div>{timeStatus.timeRemaining}</div>
            )}
          </div>
        );
      }
    } else {
      if (showTime && timeStatus.timeRemaining) {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1 leading-tight">
            {timeStatus.timeRemaining}
          </div>
        );
      }
    }
  }

  const href = referralAddress
    ? `/auction/${listingId}?ref=${referralAddress}`
    : `/auction/${listingId}`;

  // Use the same JSX structure as the original AuctionCard
  // This is a simplified version - you may need to copy the full JSX from AuctionCard.tsx
  return (
    <TransitionLink
      href={href}
      className="relative group cursor-pointer block"
    >
      <div style={{ background: gradient }}>
      {/* Image */}
      {displayImage && (
        <div className="relative w-full aspect-square overflow-hidden">
          <Image
            src={displayImage}
            alt={displayTitle}
            fill
            className={`object-cover transition-opacity duration-300 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            unoptimized={displayImage.startsWith('data:')}
          />
          {imageLoading && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">
          {displayTitle}
        </h3>
        
        {showArtist && (
          <p className="text-sm text-gray-300 mb-2">
            by {finalArtist}
          </p>
        )}
        
        {displayDescription && (
          <p className="text-xs text-gray-400 mb-2 line-clamp-2">
            {displayDescription}
          </p>
        )}
        
        {/* Price and status */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">
              {priceLabel}: {currentPrice} {tokenSymbol}
            </div>
            {stateDisplay}
          </div>
        </div>
        
        {supplyDisplay}
      </div>
      
      {/* Loading indicator for dynamic data */}
      {loadingDynamic && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="text-white text-xs">Loading...</div>
        </div>
      )}
      </div>
    </TransitionLink>
  );
}
