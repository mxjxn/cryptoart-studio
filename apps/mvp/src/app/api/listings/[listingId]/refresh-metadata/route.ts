import { NextRequest, NextResponse } from "next/server";
import { and, curation, curationItems, eq, getDatabase } from "@cryptoart/db";
import { verifyAdmin } from "~/lib/server/admin";
import { getAuctionServer } from "~/lib/server/auction";
import { requestListingMetadataRefresh } from "~/lib/server/listing-metadata-refresh";

function normalizeAddress(value: string | null | undefined) {
  return value ? value.toLowerCase() : "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    const body = await req.json().catch(() => ({}));
    const requesterAddress = normalizeAddress(body?.userAddress || body?.adminAddress);

    if (!requesterAddress) {
      return NextResponse.json({ error: "userAddress is required" }, { status: 400 });
    }

    const admin = verifyAdmin(requesterAddress);
    let allowed = admin.isAdmin;

    const listing = await getAuctionServer(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (!allowed && normalizeAddress(listing.seller) === requesterAddress) {
      allowed = true;
    }

    if (!allowed) {
      const db = getDatabase();
      const curatorMatch = await db
        .select({ id: curation.id })
        .from(curationItems)
        .innerJoin(curation, eq(curationItems.curationId, curation.id))
        .where(and(eq(curationItems.listingId, listingId), eq(curation.curatorAddress, requesterAddress)))
        .limit(1);
      allowed = curatorMatch.length > 0;
    }

    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await requestListingMetadataRefresh({
      listingId,
      tokenAddress: listing.tokenAddress,
      tokenId: listing.tokenId,
      tokenSpec: listing.tokenSpec,
    });

    if (!result.accepted) {
      return NextResponse.json({
        success: false,
        queued: false,
        cooldownRemainingMs: result.cooldownRemainingMs,
        message: "Recently refreshed, try again shortly.",
      });
    }

    return NextResponse.json({
      success: true,
      queued: true,
      cooldownRemainingMs: 0,
      message: "Refresh queued",
    });
  } catch (error) {
    console.error("[API /listings/[listingId]/refresh-metadata] Error:", error);
    return NextResponse.json({ error: "Failed to queue metadata refresh" }, { status: 500 });
  }
}
