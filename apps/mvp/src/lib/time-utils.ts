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
): { status: string; endDate?: string; timeRemaining?: string } {
  const currentTime = now || Math.floor(Date.now() / 1000);

  // If startTime is 0, auction starts on first bid
  if (startTime === 0) {
    if (!hasBid) {
      // Not started yet - endTime represents duration
      return { status: "Not started" };
    } else {
      // Has started - endTime is now absolute timestamp
      return {
        status: "Live",
        endDate: formatEndTime(endTime),
        timeRemaining: formatTimeRemaining(endTime, currentTime),
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
      };
    } else {
      // Is live
      return {
        status: "Live",
        endDate: formatEndTime(endTime),
        timeRemaining: formatTimeRemaining(endTime, currentTime),
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

