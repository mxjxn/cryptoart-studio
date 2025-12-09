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
    return `${days} day${days !== 1 ? "s" : ""} ${hours} hr${hours !== 1 ? "s" : ""} remaining`;
  } else {
    return `${hours} hr${hours !== 1 ? "s" : ""} remaining`;
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
      // Not started yet - endTime represents duration
      return { status: "Not started", neverExpires: false };
    } else {
      // Has started - endTime is now absolute timestamp
      return {
        status: "Live",
        endDate: formatEndTime(endTime),
        timeRemaining: formatTimeRemaining(endTime, currentTime),
        neverExpires: false,
      };
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
  },
  now?: number
): "cancelled" | "not started" | "active" | "concluded" | "finalized" {
  const currentTime = now || Math.floor(Date.now() / 1000);
  const startTime = typeof listing.startTime === "string" ? parseInt(listing.startTime) : listing.startTime;
  const endTime = typeof listing.endTime === "string" ? parseInt(listing.endTime) : listing.endTime;
  const hasBid = listing.hasBid || (listing.bidCount && listing.bidCount > 0) || false;

  // Check cancelled first
  if (listing.status === "CANCELLED") {
    return "cancelled";
  }

  // Check finalized
  if (listing.status === "FINALIZED") {
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
        if (endTime <= currentTime) {
          return "concluded";
        }
        return "active";
      }
    }

    // For listings with fixed start time
    if (currentTime < startTime) {
      return "not started";
    }

    // Check if ended (but not finalized)
    if (endTime <= currentTime && !isNeverExpiring(endTime)) {
      return "concluded";
    }

    // Otherwise active
    return "active";
  }

  // Default fallback
  return "active";
}


