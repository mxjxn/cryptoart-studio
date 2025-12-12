"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { useUsername } from "~/hooks/useUsername";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { CopyButton } from "~/components/CopyButton";
// import { FavoriteButton } from "~/components/FavoriteButton";
import { ListingChips } from "~/components/ListingChips";
import { ListingCardMenu } from "~/components/ListingCardMenu";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring, isLongTermSale } from "~/lib/time-utils";
import { getAuction } from "~/lib/subgraph";
import { useCountdown } from "~/hooks/useCountdown";

interface AuctionCardProps {
  auction: EnrichedAuctionData;
  gradient: string;
  index: number;
  referralAddress?: string | null;
}

export function AuctionCard({ auction, gradient, index, referralAddress }: AuctionCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
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
  
  // Get buyer username and ENS name for highest bidder
  const buyerAddress = auction.highestBid?.bidder;
  const { username: buyerUsername } = useUsername(buyerAddress || null);
  const buyerEnsName = useEnsNameForAddress(buyerAddress || null);
  
  // Get time status for display
  const startTime = parseInt(auction.startTime || "0");
  const endTime = parseInt(auction.endTime || "0");
  const hasBid = bidCount > 0 || !!auction.highestBid;
  const now = Math.floor(Date.now() / 1000);
  const isEnded = endTime <= now && !isNeverExpiring(endTime);
  const isFinalized = auction.status === "FINALIZED";
  const isCancelled = auction.status === "CANCELLED";
  const isERC1155 = auction.tokenSpec === "ERC1155" || String(auction.tokenSpec) === "2";
  
  // Only use countdown hook for active auctions that aren't ended/finalized/cancelled
  // This prevents unnecessary intervals from running
  const shouldShowCountdown = !isEnded && !isFinalized && !isCancelled && 
                              !isNeverExpiring(endTime) && !isLongTermSale(endTime);
  const countdown = useCountdown(shouldShowCountdown ? endTime : 0);
  
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
      // Active with bids: Show bid count and live countdown
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      stateDisplay = (
        <div className="text-xs text-[#999999] mt-1 leading-tight space-y-0.5">
          <div>{bidCount} {bidCount === 1 ? "bid" : "bids"}</div>
          {showTime && countdown !== "Ended" && (
            <div>{countdown}</div>
          )}
        </div>
      );
    } else {
      // Active no bids: Only show live countdown (reserve is already shown in price section)
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      if (showTime && countdown !== "Ended") {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1 leading-tight">
            {countdown}
          </div>
        );
      }
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
          <div className="text-xs text-[#999999] mt-1 leading-tight space-y-0.5">
            <div>{remaining} left</div>
            {showTime && countdown !== "Ended" && (
              <div>{countdown}</div>
            )}
          </div>
        );
      }
    } else {
      // 1/1 fixed price
      const showTime = !isNeverExpiring(endTime) && !isLongTermSale(endTime);
      if (showTime && countdown !== "Ended") {
        stateDisplay = (
          <div className="text-xs text-[#999999] mt-1 leading-tight">
            {countdown}
          </div>
        );
      }
    }
  }




  // Reset expanded state when card changes (e.g., different listing)
  useEffect(() => {
    setIsExpanded(false);
  }, [auction.listingId]);

  const listingUrl = referralAddress 
    ? `/listing/${auction.listingId}?referralAddress=${referralAddress}`
    : `/listing/${auction.listingId}`;

  return (
    <TransitionLink
      href={listingUrl}
      className="relative w-full cursor-pointer group block"
    >
      <div
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
              className={`object-contain transition-opacity duration-200 pointer-events-none ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              style={{
                objectFit: 'contain',
                pointerEvents: 'none',
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
        <div data-no-click>
          <ListingChips auction={auction} />
        </div>
        {/* FavoriteButton hidden - will reconsider placement later */}
        {/* <div className="absolute top-2 left-2">
          <FavoriteButton listingId={auction.listingId} />
        </div> */}
        {/* Overlay with gradient and data - visible on hover (desktop) or when expanded (mobile) */}
        <div 
          className={`absolute bottom-0 left-0 right-0 h-[33.33%] transition-opacity duration-300 pointer-events-none ${
            isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* Gradient background - semi-translucent to less-translucent */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent pointer-events-none"></div>
          {/* Content overlay - pointer events none so clicks pass through to link */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-10 pointer-events-none">
            {/* Title and creator with 40% opacity black background */}
            <div className="bg-black/40 px-2 py-1.5 -mx-2 -mt-2 mb-2 rounded-sm">
              <div className="text-lg font-normal mb-1 line-clamp-1">{title}</div>
              {contractName && (
                <div className="text-xs text-[#999999] mb-1 line-clamp-1">
                  {!isERC1155 && auction.tokenId && auction.erc721TotalSupply !== undefined && auction.erc721TotalSupply !== null
                    ? `${contractName} #${auction.tokenId} out of ${auction.erc721TotalSupply}`
                    : !isERC1155 && auction.tokenId
                      ? `${contractName} #${auction.tokenId}`
                      : contractName}
                </div>
              )}
              {showArtist ? (
                <div className="text-xs text-[#cccccc] pointer-events-auto">
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
                <div className="text-xs text-[#cccccc] flex items-center gap-1.5 pointer-events-auto">
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
            </div>
            {supplyDisplay}
            <div className="mb-1">
              <div className="text-xs text-[#999999] leading-tight">
                {priceLabel}
              </div>
              <div className="text-base font-medium leading-tight">
                {currentPrice} {currentPrice !== "—" && tokenSymbol}
              </div>
              {/* Show bidder info for high bids */}
              {auction.highestBid && buyerAddress && (
                <div className="text-xs text-[#999999] mt-0.5 leading-tight pointer-events-auto">
                  by{" "}
                  {buyerUsername ? (
                    <TransitionLink
                      href={`/user/${buyerUsername}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-white transition-colors"
                    >
                      @{buyerUsername}
                    </TransitionLink>
                  ) : buyerEnsName ? (
                    <TransitionLink
                      href={`/user/${buyerAddress}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-white transition-colors"
                    >
                      {buyerEnsName}
                    </TransitionLink>
                  ) : (
                    <TransitionLink
                      href={`/user/${buyerAddress}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[10px] hover:text-white transition-colors"
                    >
                      {`${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`}
                    </TransitionLink>
                  )}
                </div>
              )}
            </div>
            {stateDisplay}
          </div>
        </div>
      </div>
      {/* Title and Artist - Always visible below image */}
      <div className="mt-2 px-1">
        <div className="text-xs font-normal text-white line-clamp-1 mb-0.5">{title}</div>
        {showArtist ? (
          <div className="text-[10px] text-[#999999] line-clamp-1">
            by{" "}
            {creatorUsername ? (
              <TransitionLink
                href={`/user/${creatorUsername}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-white transition-colors"
              >
                {displayArtist}
              </TransitionLink>
            ) : addressToShow ? (
              <TransitionLink
                href={`/user/${addressToShow}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-white transition-colors"
              >
                {displayArtist}
              </TransitionLink>
            ) : (
              displayArtist
            )}
          </div>
        ) : addressToShow && !artistNameLoading ? (
          <div className="text-[10px] text-[#999999] flex items-center gap-1.5">
            <TransitionLink
              href={creatorUsername ? `/user/${creatorUsername}` : `/user/${addressToShow}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono hover:text-white transition-colors"
            >
              {`${addressToShow.slice(0, 6)}...${addressToShow.slice(-4)}`}
            </TransitionLink>
            <CopyButton text={addressToShow} size="sm" />
          </div>
        ) : null}
      </div>
      {/* Listing Card Menu - Below the card (includes Gallery + Admin options) */}
      <div className="mt-2 flex justify-end pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <ListingCardMenu 
          listingId={auction.listingId}
          sellerAddress={auction.seller}
        />
      </div>
    </TransitionLink>
  );
}

