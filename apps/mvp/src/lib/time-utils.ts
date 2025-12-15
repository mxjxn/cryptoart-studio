/**
 * Time utility functions for listing displays
 */

const MAX_UINT48 = 281474976710655; // type(uint48).max

/**
 * Check if endTime represents a never-expiring listing
 */
export function isNeverExpiring(endTime: number): boolean {
  return endTime >= MAX_UINT48;
}

/**
 * Format end time as "ends [date] at [time]"
 */
export function formatEndTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Format time remaining as "[days] days [h] hrs remaining"
 * Example: "3 days 5 hrs remaining" or "12 hrs remaining"
 */
export function formatTimeRemaining(endTime: number, now?: number): string {
  const currentTime = now || Math.floor(Date.now() / 1000);
  const timeRemaining = endTime > currentTime ? endTime - currentTime : 0;

  if (timeRemaining <= 0) {
    return "Ended";
  }

  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);

  if (days > 0) {
    return `ends in ${days} day${days !== 1 ? "s" : ""} ${hours} hr${hours !== 1 ? "s" : ""}`;
  } else {
    return `ends in ${hours} hr${hours !== 1 ? "s" : ""}`;
  }
}

/**
 * Get auction time status information
 * Returns status text, end date, and time remaining based on auction configuration
 */
export function getAuctionTimeStatus(
  startTime: number,
  endTime: number,
  hasBid: boolean,
  now?: number
): { status: string; endDate?: string; timeRemaining?: string; neverExpires: boolean } {
  const currentTime = now || Math.floor(Date.now() / 1000);

  // Check if this is a never-expiring listing (shouldn't happen for auctions, but handle gracefully)
  if (isNeverExpiring(endTime)) {
    return {
      status: "Live",
      neverExpires: true,
    };
  }

  // If startTime is 0, auction starts on first bid
  if (startTime === 0) {
    if (!hasBid) {
      // Not started yet - endTime should represent duration, not absolute timestamp
      // However, due to a bug, some listings might have absolute timestamps in subgraph
      // Detect if endTime looks like an absolute timestamp (> 1 year in future)
      const oneYearInSeconds = 365 * 24 * 60 * 60;
      const isLikelyAbsoluteTimestamp = endTime > currentTime + oneYearInSeconds;
      
      if (isLikelyAbsoluteTimestamp) {
        // This is likely an absolute timestamp due to the bug - don't display time remaining
        // because we can't know when the auction will start (depends on first bid)
        // The auction should be marked as "at-risk" and seller should update it
        return { status: "Not started", neverExpires: false };
      } else {
        // endTime is a duration (or a small absolute timestamp that's in the past/near future)
        // Still can't show time remaining because we don't know when auction starts
        return { status: "Not started", neverExpires: false };
      }
    } else {
      // Has started - endTime should be absolute timestamp after contract processed first bid
      // However, if the bug occurred, endTime might be way in the future
      // Check if it's unreasonably far in the future (> 10 years)
      const tenYearsInSeconds = 10 * 365 * 24 * 60 * 60;
      const isBuggyEndTime = endTime > currentTime + tenYearsInSeconds;
      
      if (isBuggyEndTime) {
        // Bug occurred - endTime is way in the future, can't display meaningful time remaining
        return {
          status: "Live",
          neverExpires: false,
          // Don't set timeRemaining or endDate as they would be misleading
        };
      } else {
        // Normal case - endTime is a reasonable absolute timestamp
        return {
          status: "Live",
          endDate: formatEndTime(endTime),
          timeRemaining: formatTimeRemaining(endTime, currentTime),
          neverExpires: false,
        };
      }
    }
  } else {
    // Has fixed start time
    if (currentTime < startTime) {
      // Not started yet
      return {
        status: "Not started",
        endDate: formatEndTime(endTime),
        timeRemaining: formatTimeRemaining(endTime, currentTime),
        neverExpires: false,
      };
    } else {
      // Is live
      return {
        status: "Live",
        endDate: formatEndTime(endTime),
        timeRemaining: formatTimeRemaining(endTime, currentTime),
        neverExpires: false,
      };
    }
  }
}

/**
 * Get fixed price listing time status
 */
export function getFixedPriceTimeStatus(
  endTime: number,
  now?: number
): { endDate?: string; timeRemaining?: string; neverExpires: boolean } {
  if (isNeverExpiring(endTime)) {
    return { neverExpires: true };
  }

  const currentTime = now || Math.floor(Date.now() / 1000);
  if (endTime <= currentTime) {
    return { neverExpires: false };
  }

  return {
    neverExpires: false,
    endDate: formatEndTime(endTime),
    timeRemaining: formatTimeRemaining(endTime, currentTime),
  };
}

/**
 * Check if a sale is a long-term sale (more than 1 year)
 * For very long sales, we should hide time details
 */
export function isLongTermSale(endTime: number): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  return endTime > currentTime + oneYearInSeconds;
}

/**
 * Get display status for a listing
 * Returns: "cancelled" | "not started" | "active" | "concluded" | "finalized"
 */
export function getListingDisplayStatus(
  listing: {
    status: "ACTIVE" | "FINALIZED" | "CANCELLED";
    listingType: "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "DYNAMIC_PRICE" | "OFFERS_ONLY";
    startTime: string | number;
    endTime: string | number;
    hasBid?: boolean;
    bidCount?: number;
    bids?: Array<{ id: string; bidder: string; amount: string; timestamp: string }>;
    finalized?: boolean; // Subgraph also has a finalized boolean field
  },
  now?: number
): "cancelled" | "not started" | "active" | "concluded" | "finalized" {
  const currentTime = now || Math.floor(Date.now() / 1000);
  const startTime = typeof listing.startTime === "string" ? parseInt(listing.startTime) : listing.startTime;
  const endTime = typeof listing.endTime === "string" ? parseInt(listing.endTime) : listing.endTime;
  // For start-on-first-bid auctions, prioritize actual bid data over subgraph hasBid field
  // The subgraph hasBid field can be stale, so we check bidCount and bids array first
  // If bidCount is 0 or bids array is empty, the auction hasn't started regardless of hasBid
  const actualBidCount = listing.bidCount ?? listing.bids?.length;
  // If we have bid data (bidCount or bids array), use that as the source of truth
  // If actualBidCount is 0, hasBid is definitely false (auction hasn't started)
  // Otherwise fall back to listing.hasBid if we don't have bid count data
  const hasBid = actualBidCount !== undefined ? actualBidCount > 0 : (listing.hasBid || false);

  // Check cancelled first
  if (listing.status === "CANCELLED") {
    return "cancelled";
  }

  // Check finalized - check both status field and finalized boolean field
  // The finalized boolean is more reliable as it's set directly by the contract
  if (listing.status === "FINALIZED" || listing.finalized === true) {
    return "finalized";
  }

  // For active listings, determine if they're not started, active, or concluded
  if (listing.status === "ACTIVE") {
    // For auctions with startTime = 0, they start on first bid
    if (listing.listingType === "INDIVIDUAL_AUCTION" && startTime === 0) {
      if (!hasBid) {
        return "not started";
      } else {
        // Has started, check if ended
        // For start-on-first-bid auctions, endTime can be either:
        // 1. A duration (in seconds) if subgraph hasn't updated yet
        // 2. A timestamp if contract has already converted it
        // Heuristic: if endTime is less than 1 year (31536000 seconds), it's likely a duration
        const ONE_YEAR_IN_SECONDS = 31536000;
        
        if (endTime > currentTime) {
          // endTime is greater than current time, so it's likely a timestamp
          // and the auction hasn't ended yet
          return "active";
        } else if (endTime <= ONE_YEAR_IN_SECONDS) {
          // endTime is a small number (duration), and it's <= currentTime
          // This means the subgraph hasn't updated yet, or it's a very short duration
          // Without the auction start timestamp, we can't determine if it's ended
          // Default to "active" for safety (the listing page will show correct status)
          return "active";
        } else {
          // endTime is a large number (timestamp) and <= currentTime, so it's concluded
          return "concluded";
        }
      }
    }

    // For FIXED_PRICE, OFFERS_ONLY, DYNAMIC_PRICE listings with startTime = 0, endTime is a duration (not a timestamp)
    // The listing is active immediately, and endTime represents duration from creation
    // Same logic as auctions: if startTime = 0, endTime is a duration until first purchase/offer
    // For these listing types, we need to check if they've been purchased/offered to determine if started
    // For now, we'll treat them as active if status is ACTIVE (the listing page will show correct status)
    if ((listing.listingType === "FIXED_PRICE" || listing.listingType === "OFFERS_ONLY" || listing.listingType === "DYNAMIC_PRICE") && startTime === 0) {
      // endTime is a duration, not a timestamp
      // If endTime is MAX_UINT48 or very large, it's never-expiring
      if (isNeverExpiring(endTime)) {
        return "active";
      }
      // For startTime=0 non-auction listings, they're active immediately
      // We can't determine if ended without creation timestamp, so default to active
      return "active";
    }

    // For listings with fixed start time
    if (currentTime < startTime) {
      return "not started";
    }

    // Check if ended (but not finalized)
    // For listings with fixed startTime, endTime is a timestamp
    if (endTime <= currentTime && !isNeverExpiring(endTime)) {
      return "concluded";
    }

    // Otherwise active
    return "active";
  }

  // Default fallback
  return "active";
}


