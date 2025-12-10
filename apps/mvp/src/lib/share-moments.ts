import type { EnrichedAuctionData } from "~/lib/types";

export type ShareMomentType =
  | "auction-created"
  | "bid-placed"
  | "auction-won"
  | "outbid"
  | "referral"
  | "top-bid"
  | "being-outbid";

interface ShareMomentData {
  listingId: string;
  artworkName?: string;
  artistName?: string;
  artistAddress?: string;
  artistFid?: number;
  bidAmount?: string;
  salePrice?: string;
  currentBid?: string;
  reservePrice?: string;
  endTime?: string;
  paymentSymbol?: string;
  paymentDecimals?: number;
  topBidderName?: string;
  topBidderAddress?: string;
  topBidAmount?: string;
}

/**
 * Format price to 2 decimal places for sharing
 */
export function formatPriceForShare(
  amount: string,
  decimals: number = 18
): string {
  try {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    // Round to 2 decimal places
    if (fractionalStr.length > 2) {
      const thirdDigit = parseInt(fractionalStr[2] || "0");
      fractionalStr = fractionalStr.slice(0, 2);
      if (thirdDigit >= 5) {
        // Round up
        const rounded = parseInt(fractionalStr) + 1;
        fractionalStr = rounded.toString().padStart(2, "0");
        if (fractionalStr.length > 2) {
          // Carried over to whole part
          return (wholePart + BigInt(1)).toString();
        }
      }
    }

    // Remove trailing zeros
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length === 0) {
      return wholePart.toString();
    }

    return `${wholePart}.${fractionalStr}`;
  } catch (error) {
    console.error("Error formatting price:", error);
    return "0";
  }
}

/**
 * Get artist mention format (@username or display name)
 * Note: This is a client-safe version that doesn't do server-side lookups
 * For server-side lookups, use the server version in artist-name-resolution.ts
 */
export function getArtistMention(
  artistName?: string | null
): string {
  if (!artistName) {
    return "artist";
  }
  
  // If it's already a username format, return as is, otherwise add @
  return artistName.startsWith("@")
    ? artistName
    : `@${artistName}`;
}

/**
 * Generate cast text based on moment type
 */
export function generateShareCastText(
  momentType: ShareMomentType,
  data: ShareMomentData
): string {
  const artworkName =
    data.artworkName || `Auction #${data.listingId}`;
  const artistMention = getArtistMention(data.artistName);

  switch (momentType) {
    case "auction-created":
      return `New work up for auction on cryptoart.social 🎨`;

    case "bid-placed":
      return `Bidding on ${artworkName} by ${artistMention}`;

    case "auction-won":
      return `Just collected ${artworkName} by ${artistMention} ✨`;

    case "outbid":
      return `Bid war heating up 🔥`;

    case "referral":
      return `Check out this piece by ${artistMention}`;

    case "top-bid": {
      const topBidderMention = data.topBidderName 
        ? getArtistMention(data.topBidderName)
        : "someone";
      const bidAmount = data.topBidAmount 
        ? formatPriceForShare(data.topBidAmount, data.paymentDecimals || 18)
        : "a bid";
      const tokenSymbol = data.paymentSymbol || "ETH";
      return `${topBidderMention} is winning ${artworkName} by ${artistMention} with a bid of ${bidAmount} ${tokenSymbol}!`;
    }

    case "being-outbid": {
      const topBidderMention = data.topBidderName 
        ? getArtistMention(data.topBidderName)
        : "someone";
      const bidAmount = data.topBidAmount 
        ? formatPriceForShare(data.topBidAmount, data.paymentDecimals || 18)
        : "a bid";
      const tokenSymbol = data.paymentSymbol || "ETH";
      return `I've been outbid! Bid from ${topBidderMention} of ${bidAmount} ${tokenSymbol} on ${artworkName} by ${artistMention}`;
    }

    default:
      return `Check out this auction on cryptoart.social`;
  }
}

/**
 * Generate share OG image URL
 */
export function generateShareOGImageUrl(
  momentType: ShareMomentType,
  listingId: string,
  params?: {
    bidAmount?: string;
    salePrice?: string;
    currentBid?: string;
    topBidAmount?: string;
    topBidderAddress?: string;
  }
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const url = new URL(`${baseUrl}/share/${momentType}/${listingId}`);

  if (params?.bidAmount) {
    url.searchParams.set("bidAmount", params.bidAmount);
  }
  if (params?.salePrice) {
    url.searchParams.set("salePrice", params.salePrice);
  }
  if (params?.currentBid) {
    url.searchParams.set("currentBid", params.currentBid);
  }
  if (params?.topBidAmount) {
    url.searchParams.set("topBidAmount", params.topBidAmount);
  }
  if (params?.topBidderAddress) {
    url.searchParams.set("topBidderAddress", params.topBidderAddress);
  }

  return url.toString();
}

/**
 * Generate share URL (the link that will be embedded in the cast)
 * This is the URL that redirects to the listing page
 */
export function generateShareUrl(
  momentType: ShareMomentType,
  listingId: string,
  referralAddress?: string | null
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const url = new URL(`${baseUrl}/share/${momentType}/${listingId}`);

  if (referralAddress) {
    url.searchParams.set("referralAddress", referralAddress);
  }

  return url.toString();
}

