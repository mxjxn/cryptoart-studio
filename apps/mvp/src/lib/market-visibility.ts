import { getListingDisplayStatus } from "~/lib/time-utils";
import { normalizeListingType } from "~/lib/server/auction";

/** Default market browse hides ended inventory; optional toggle shows it. */
export type MarketBrowseMode = "live" | "include-ended";

/** Discoverability label for cards / debug — not a separate browse bucket. */
export type MarketListingKind =
  | "live"
  | "awaiting-bid"
  | "scheduled"
  | "open-sale"
  | "ended";

export function isListingSoldOut(listing: {
  totalSold?: string | number;
  totalAvailable?: string | number;
}): boolean {
  const ta = parseInt(String(listing.totalAvailable ?? "0"), 10);
  const ts = parseInt(String(listing.totalSold ?? "0"), 10);
  return ta > 0 && ts >= ta;
}

function rawToDisplayInput(listing: Record<string, unknown>) {
  const bids = listing.bids as
    | { id: string; bidder: string; amount: string; timestamp: string }[]
    | undefined;
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

/** Hard excludes — never shown on market regardless of browse mode. */
export function isMarketListingHardExcluded(listing: Record<string, unknown>): boolean {
  if (listing.status === "CANCELLED") return true;
  return false;
}

/** Ended / unavailable for the default live browse feed. */
export function isMarketListingEnded(listing: Record<string, unknown>, nowSec?: number): boolean {
  if (listing.status === "FINALIZED" || listing.finalized === true) return true;
  if (isListingSoldOut(listing)) return true;

  const display = getListingDisplayStatus(rawToDisplayInput(listing), nowSec);
  return display === "concluded" || display === "finalized" || display === "cancelled";
}

/**
 * Whether a listing appears in the market browse grid for the given mode.
 *
 * **live (default):** open auctions (including awaiting first bid), scheduled listings,
 * and fixed-price / edition sales with remaining inventory.
 *
 * **include-ended:** also shows sold out, time-concluded, and finalized listings.
 */
export function isVisibleOnMarket(
  listing: Record<string, unknown>,
  mode: MarketBrowseMode = "live",
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  if (isMarketListingHardExcluded(listing)) return false;
  if (mode === "include-ended") return true;
  return !isMarketListingEnded(listing, nowSec);
}

export function getMarketListingKind(
  listing: Record<string, unknown>,
  nowSec: number = Math.floor(Date.now() / 1000)
): MarketListingKind {
  if (isMarketListingHardExcluded(listing) || isMarketListingEnded(listing, nowSec)) {
    return "ended";
  }

  const listingType = normalizeListingType(listing.listingType as never, listing as never);
  const display = getListingDisplayStatus(rawToDisplayInput(listing), nowSec);
  const bidCount =
    (listing.bids as { id: string }[] | undefined)?.length ??
    (typeof listing.bidCount === "number" ? listing.bidCount : 0);
  const hasBid = listing.hasBid === true || bidCount > 0;

  if (
    listingType === "FIXED_PRICE" ||
    listingType === "DYNAMIC_PRICE" ||
    listingType === "OFFERS_ONLY"
  ) {
    return "open-sale";
  }

  if (display === "not started") {
    if (listingType === "INDIVIDUAL_AUCTION" && parseInt(String(listing.startTime ?? "0"), 10) === 0) {
      return "awaiting-bid";
    }
    return "scheduled";
  }

  if (listingType === "INDIVIDUAL_AUCTION" && !hasBid) {
    return "awaiting-bid";
  }

  return "live";
}
