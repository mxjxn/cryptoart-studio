import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getAuctionServer } from "~/lib/server/auction";
import {
  getSellerDefaultThemeRow,
  getListingThemeOverrideRow,
} from "~/lib/server/listing-theme-persistence";
import { resolveThemeLayers } from "~/lib/listing-theme";

export const dynamic = "force-dynamic";

/**
 * Never cache listing theme on shared caches — after PATCH, clients must see
 * fresh merged theme immediately (browser fetch can otherwise reuse stale GET).
 */
function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
}

/**
 * GET /api/listing-theme?listingId=… — resolve seller from listing, merge override + default.
 * GET /api/listing-theme?seller=0x… — default theme for that seller only.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get("listingId");
    const sellerParam = searchParams.get("seller");

    if (listingId) {
      const auction = await getAuctionServer(listingId);
      if (!auction?.seller) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }
      const sellerLower = String(auction.seller).toLowerCase();
      const defaultTheme = await getSellerDefaultThemeRow(sellerLower);
      const overrideRow = await getListingThemeOverrideRow(listingId);
      let overrideTheme = overrideRow?.theme ?? null;
      if (
        overrideRow &&
        overrideRow.sellerAddress !== sellerLower
      ) {
        overrideTheme = null;
      }
      const { theme, source } = resolveThemeLayers(defaultTheme, overrideTheme);
      return jsonNoStore({
        theme,
        source,
        sellerAddress: sellerLower,
        listingId,
      });
    }

    if (sellerParam) {
      if (!isAddress(sellerParam as Address)) {
        return NextResponse.json({ error: "Invalid seller address" }, { status: 400 });
      }
      const sellerLower = sellerParam.toLowerCase();
      const defaultTheme = await getSellerDefaultThemeRow(sellerLower);
      const { theme, source } = resolveThemeLayers(defaultTheme, null);
      return jsonNoStore({
        theme,
        source,
        sellerAddress: sellerLower,
      });
    }

    return NextResponse.json(
      { error: "Query listingId or seller is required" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[listing-theme GET]", e);
    return NextResponse.json({ error: "Failed to load theme" }, { status: 500 });
  }
}
