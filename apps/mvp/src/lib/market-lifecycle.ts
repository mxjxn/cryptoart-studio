import { getListingDisplayStatus } from "~/lib/time-utils";
import { normalizeListingType } from "~/lib/server/auction";

export type MarketLifecycleTab = "active" | "upcoming" | "finished";

/** No remaining inventory (subgraph can still show status ACTIVE until finalize). */
export function isListingSoldOut(listing: {
  totalSold?: string | number;
  totalAvailable?: string | number;
}): boolean {
  const ta = parseInt(String(listing.totalAvailable ?? "0"), 10);
  const ts = parseInt(String(listing.totalSold ?? "0"), 10);
  return ta > 0 && ts >= ta;
}

function rawToDisplayInput(listing: Record<string, unknown>) {
  const bids = listing.bids as { id: string; bidder: string; amount: string; timestamp: string }[] | undefined;
  const bidCount = bids?.length ?? 0;
  return {
    status: listing.status as "ACTIVE" | "FINALIZED" | "CANCELLED",
    listingType: normalizeListingType(listing.listingType as never, listing as never),
    startTime: listing.startTime as string,
    endTime: listing.endTime as string,
    hasBid: listing.hasBid as boolean | undefined,
    bidCount,
    bids,
    finalized: listing.finalized as boolean | undefined,
  };
}

/**
 * Route each listing into a market tab. Sold-out-but-still-ACTIVE → finished.
 */
export function classifyMarketLifecycle(
  listing: Record<string, unknown>,
  nowSec: number = Math.floor(Date.now() / 1000)
): MarketLifecycleTab {
  if (listing.status === "CANCELLED") return "finished";
  if (listing.status === "FINALIZED" || listing.finalized === true) return "finished";
  if (isListingSoldOut(listing)) return "finished";

  const display = getListingDisplayStatus(rawToDisplayInput(listing), nowSec);
  if (display === "not started") return "upcoming";
  if (display === "concluded" || display === "finalized" || display === "cancelled") {
    return "finished";
  }
  return "active";
}
