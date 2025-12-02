"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { CopyButton } from "~/components/CopyButton";
import type { EnrichedAuctionData } from "~/lib/types";
import { type Address } from "viem";

interface AuctionCardProps {
  auction: EnrichedAuctionData;
  gradient: string;
  index: number;
}

export function AuctionCard({ auction, gradient, index }: AuctionCardProps) {
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

  // Listing type badge colors
  const getListingTypeBadge = () => {
    switch (auction.listingType) {
      case "FIXED_PRICE":
        return (
          <span className="absolute top-2 right-2 px-2 py-1 bg-white/90 text-black text-[10px] font-medium tracking-[0.5px] rounded">
            Buy Now
          </span>
        );
      case "OFFERS_ONLY":
        return (
          <span className="absolute top-2 right-2 px-2 py-1 bg-amber-500/90 text-black text-[10px] font-medium tracking-[0.5px] rounded">
            Offers
          </span>
        );
      default:
        return (
          <span className="absolute top-2 right-2 px-2 py-1 bg-purple-500/90 text-black text-[10px] font-medium tracking-[0.5px] rounded">
            Auction
          </span>
        );
    }
  };

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
        {getListingTypeBadge()}
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
        </div>
      </div>
    </Link>
  );
}

