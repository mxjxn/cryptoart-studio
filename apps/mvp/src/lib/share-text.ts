import type { EnrichedAuctionData } from './types';
import { isETH } from '~/hooks/useERC20Token';

/**
 * Format price for display in share text
 */
function formatPriceForShare(amount: string, decimals: number): string {
  const value = BigInt(amount || "0");
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  fractionalStr = fractionalStr.replace(/0+$/, "");
  if (fractionalStr.length > 4) {
    fractionalStr = fractionalStr.slice(0, 4);
  }
  
  return `${wholePart}.${fractionalStr}`;
}

/**
 * Format time for share text
 */
function formatTimeForShare(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Format time remaining (e.g., "one week from first bid")
 */
function formatTimeRemaining(endTime: number, startTime: number, now: number, hasBid: boolean): string {
  if (startTime === 0) {
    // If startTime is 0, it means "starts on first bid/purchase"
    // If no bid yet, endTime represents duration from first bid
    // If bid exists, endTime is absolute timestamp
    if (!hasBid) {
      // No bid yet, endTime is duration
      const durationSeconds = endTime;
      const days = Math.floor(durationSeconds / 86400);
      const weeks = Math.floor(days / 7);
      
      if (weeks >= 1) {
        return `one week from first bid`;
      } else if (days >= 1) {
        return `${days} day${days !== 1 ? 's' : ''} from first bid`;
      } else {
        const hours = Math.floor(durationSeconds / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} from first bid`;
      }
    } else {
      // Has bid, endTime is absolute timestamp
      return `is live until ${formatTimeForShare(endTime)}`;
    }
  } else {
    // Has a specific start time
    if (now < startTime) {
      // Hasn't started yet
      return `begins at ${formatTimeForShare(startTime)}`;
    } else {
      // Is live, show end time
      return `is live until ${formatTimeForShare(endTime)}`;
    }
  }
}

/**
 * Get listing type display name
 */
function getListingTypeName(listingType: string): string {
  switch (listingType) {
    case "INDIVIDUAL_AUCTION":
      return "Auction";
    case "FIXED_PRICE":
      return "Fixed Price";
    case "OFFERS_ONLY":
      return "Offers Only";
    case "DYNAMIC_PRICE":
      return "Dynamic Price";
    default:
      return "Listing";
  }
}

/**
 * Format artist name for share text
 * Priority: @artist (Farcaster username) > override-artistname > ENS > 0xaddress
 */
function formatArtistForShare(
  artistName: string | null | undefined,
  creatorAddress: string | null | undefined,
  creatorUsername: string | null | undefined
): string {
  if (creatorUsername) {
    return `@${creatorUsername}`;
  }
  if (artistName) {
    return artistName;
  }
  if (creatorAddress) {
    // Check if it looks like an ENS name (contains .eth)
    if (creatorAddress.includes('.eth')) {
      return creatorAddress;
    }
    // Format as 0x address
    return creatorAddress;
  }
  return "";
}

/**
 * Generate share text for a listing
 */
export function generateListingShareText(
  auction: EnrichedAuctionData,
  contractName: string | null | undefined,
  artistName: string | null | undefined,
  creatorAddress: string | null | undefined,
  creatorUsername: string | null | undefined,
  paymentSymbol: string,
  paymentDecimals: number
): string {
  const lines: string[] = [];
  
  // Title
  const title = auction.title || `Listing #${auction.listingId}`;
  lines.push(title);
  
  // Collection
  if (contractName) {
    lines.push(contractName);
  }
  
  // Artist
  const artistText = formatArtistForShare(artistName, creatorAddress, creatorUsername);
  if (artistText) {
    lines.push(artistText);
  }
  
  // Listing type
  const listingTypeName = getListingTypeName(auction.listingType);
  lines.push(listingTypeName);
  
  // Price or reserve
  let priceText = "";
  if (auction.listingType === "INDIVIDUAL_AUCTION") {
    if (auction.highestBid) {
      priceText = formatPriceForShare(auction.highestBid.amount, paymentDecimals);
    } else {
      priceText = formatPriceForShare(auction.initialAmount, paymentDecimals);
    }
  } else if (auction.listingType === "FIXED_PRICE") {
    priceText = formatPriceForShare(auction.initialAmount, paymentDecimals);
  } else if (auction.listingType === "OFFERS_ONLY") {
    priceText = "Offers";
  } else if (auction.listingType === "DYNAMIC_PRICE") {
    priceText = "Dynamic Price";
  }
  
  if (priceText) {
    lines.push(`${priceText} ${paymentSymbol}`);
  }
  
  // Timing information
  const now = Math.floor(Date.now() / 1000);
  const startTime = auction.startTime ? parseInt(auction.startTime) : 0;
  const endTime = auction.endTime ? parseInt(auction.endTime) : 0;
  const hasBid = !!(auction.highestBid || auction.bidCount > 0);
  
  if (endTime > 0) {
    const timeText = formatTimeRemaining(endTime, startTime, now, hasBid);
    lines.push(timeText);
  }
  
  // "on /cryptoart."
  lines.push("on /cryptoart.");
  
  return lines.join("\n");
}

