import { NextRequest, NextResponse } from "next/server";
import { getCachedActiveAuctions } from "~/lib/server/auction";
import { withTimeout } from "~/lib/utils";

const MAX_IDS = 20;
const HYDRATION_TIMEOUT_MS = 1800;

type HydrationItem = {
  listingId: string;
  currentPrice: string;
  listingType: string;
  status: string;
  bidCount: number;
  highestBid?: {
    amount: string;
    bidder: string;
    timestamp: string;
  };
};

function parseIds(searchParams: URLSearchParams): string[] {
  const idsParam = searchParams.get("ids");
  if (!idsParam) return [];
  return idsParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const ids = parseIds(searchParams);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, items: {}, timingMs: 0 });
    }

    const fallback: Record<string, HydrationItem> = {};
    const items = await withTimeout(
      (async () => {
        const auctions = await getCachedActiveAuctions(250, 0, false);
        const byId: Record<string, HydrationItem> = {};
        for (const listing of auctions) {
          if (!ids.includes(String(listing.listingId))) continue;
          const bidAmount = listing.highestBid?.amount;
          const topBidBidder =
            listing.highestBid?.bidder ||
            (Array.isArray(listing.bids) && listing.bids.length > 0
              ? String(listing.bids[0]?.bidder || "")
              : "");
          const topBidTimestamp =
            listing.highestBid?.timestamp ||
            (Array.isArray(listing.bids) && listing.bids.length > 0
              ? String(listing.bids[0]?.timestamp || "0")
              : "0");
          byId[String(listing.listingId)] = {
            listingId: String(listing.listingId),
            currentPrice: bidAmount || listing.currentPrice || listing.initialAmount || "0",
            listingType: String(listing.listingType || "INDIVIDUAL_AUCTION"),
            status: String(listing.status || "ACTIVE"),
            bidCount: listing.bidCount || (listing.bids?.length ?? 0),
            highestBid: listing.highestBid
              ? {
                  amount: String(listing.highestBid.amount || "0"),
                  bidder: String(topBidBidder),
                  timestamp: String(topBidTimestamp),
                }
              : undefined,
          };
        }
        return byId;
      })(),
      HYDRATION_TIMEOUT_MS,
      fallback
    );

    const elapsed = Date.now() - startedAt;
    console.log(
      `[API /redesign/hydration] ids=${ids.length} resolved=${Object.keys(items).length} in ${elapsed}ms${
        items === fallback ? " (fallback)" : ""
      }`
    );

    return NextResponse.json(
      { success: true, items, timingMs: elapsed },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    console.error("[API /redesign/hydration] failed:", error);
    return NextResponse.json(
      { success: false, items: {}, timingMs: elapsed },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  }
}
