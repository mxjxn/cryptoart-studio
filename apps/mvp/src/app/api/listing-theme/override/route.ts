import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { hasGalleryAccess } from "~/lib/server/nft-access";
import { getAuctionServer } from "~/lib/server/auction";
import { validateListingTheme } from "~/lib/listing-theme";
import {
  upsertListingThemeOverride,
  deleteListingThemeOverride,
} from "~/lib/server/listing-theme-persistence";
import {
  collectCandidateAddresses,
  sellerMatchesCandidates,
} from "~/lib/server/listing-theme-candidates";

/**
 * PATCH body: { userAddress, verifiedAddresses?, listingId, theme: ListingThemeData | null }
 * theme null removes the per-listing override.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAddress, verifiedAddresses, listingId, theme } = body as {
      userAddress?: string;
      verifiedAddresses?: string[];
      listingId?: string;
      theme?: unknown | null;
    };

    if (!userAddress || !isAddress(userAddress as Address)) {
      return NextResponse.json({ error: "Valid userAddress is required" }, { status: 400 });
    }
    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json({ error: "listingId is required" }, { status: 400 });
    }

    const allowed = await hasGalleryAccess(
      userAddress as Address,
      Array.isArray(verifiedAddresses) ? verifiedAddresses : undefined
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Membership required to customize listing pages" },
        { status: 403 }
      );
    }

    const auction = await getAuctionServer(listingId);
    if (!auction?.seller) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const sellerLower = String(auction.seller).toLowerCase();
    const candidates = collectCandidateAddresses(userAddress, verifiedAddresses);
    if (!sellerMatchesCandidates(sellerLower, candidates)) {
      return NextResponse.json(
        { error: "You can only set an override for listings you sell" },
        { status: 403 }
      );
    }

    if (theme === null) {
      await deleteListingThemeOverride(listingId);
      return NextResponse.json({ ok: true, theme: null });
    }

    const parsed = validateListingTheme(theme);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await upsertListingThemeOverride(listingId, sellerLower, parsed.theme);

    return NextResponse.json({ ok: true, theme: parsed.theme });
  } catch (e) {
    console.error("[listing-theme/override PATCH]", e);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }
}
