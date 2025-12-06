"use client";

import React from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { getListingDisplayStatus } from "~/lib/time-utils";

interface ListingChipsProps {
  auction: EnrichedAuctionData;
}

/**
 * Get gradient background for status chip
 */
function getStatusGradient(status: ReturnType<typeof getListingDisplayStatus>): string {
  switch (status) {
    case "cancelled":
      return "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"; // Gray
    case "not started":
      return "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"; // Amber/Yellow
    case "active":
      return "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // Green
    case "concluded":
      return "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"; // Blue
    case "finalized":
      return "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"; // Purple
    default:
      return "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"; // Gray fallback
  }
}

/**
 * Get gradient background for type chip
 */
function getTypeGradient(
  listingType: EnrichedAuctionData["listingType"],
  tokenSpec: EnrichedAuctionData["tokenSpec"]
): string {
  if (listingType === "FIXED_PRICE") {
    if (tokenSpec === "ERC1155") {
      return "linear-gradient(135deg, #ec4899 0%, #db2777 100%)"; // Pink for 1155 fixed price
    } else {
      return "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"; // Cyan for 1/1 fixed price
    }
  } else if (listingType === "INDIVIDUAL_AUCTION") {
    return "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"; // Purple for auctions
  } else if (listingType === "OFFERS_ONLY") {
    return "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"; // Orange for offers only
  } else {
    return "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"; // Gray fallback
  }
}

/**
 * Get display text for status
 */
function getStatusText(status: ReturnType<typeof getListingDisplayStatus>): string {
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "not started":
      return "Not Started";
    case "active":
      return "Active";
    case "concluded":
      return "Concluded";
    case "finalized":
      return "Finalized";
    default:
      return "Unknown";
  }
}

/**
 * Get display text for type
 */
function getTypeText(
  listingType: EnrichedAuctionData["listingType"],
  tokenSpec: EnrichedAuctionData["tokenSpec"]
): string {
  if (listingType === "FIXED_PRICE") {
    if (tokenSpec === "ERC1155") {
      return "1155";
    } else {
      return "1/1";
    }
  } else if (listingType === "INDIVIDUAL_AUCTION") {
    return "Auction";
  } else if (listingType === "OFFERS_ONLY") {
    return "Offers";
  } else {
    return "Listing";
  }
}

export function ListingChips({ auction }: ListingChipsProps) {
  const displayStatus = getListingDisplayStatus(auction);
  const statusGradient = getStatusGradient(displayStatus);
  const typeGradient = getTypeGradient(auction.listingType, auction.tokenSpec);
  const statusText = getStatusText(displayStatus);
  const typeText = getTypeText(auction.listingType, auction.tokenSpec);

  return (
    <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
      <span
        className="px-2.5 py-1 text-[10px] font-medium tracking-[0.5px] rounded-full text-white"
        style={{ background: statusGradient }}
      >
        {statusText}
      </span>
      <span
        className="px-2.5 py-1 text-[10px] font-medium tracking-[0.5px] rounded-full text-white"
        style={{ background: typeGradient }}
      >
        {typeText}
      </span>
    </div>
  );
}

