import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { browseListings } from "~/lib/server/browse-listings";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import {
  getListingPreviewsByIds,
  upsertListingPreview,
} from "~/lib/server/listing-preview-store";
import type { EnrichedAuctionData } from "~/lib/types";

export const maxDuration = 120;

const CONCURRENCY = 3;
const DEFAULT_LIMIT = 25;
/** Refresh rows older than this even if they have an image */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item !== undefined) await fn(item);
      }
    }),
  );
}

/**
 * GET /api/cron/listing-previews
 * Backfills listing_media_preview for market grids (Bearer CRON_SECRET).
 * Query: limit (default 25, max 80), skip (subgraph skip for pagination).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") || "", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : 25, 1),
    80,
  );
  const skipSubgraph = parseInt(req.nextUrl.searchParams.get("skip") || "0", 10) || 0;

  try {
    const { listings } = await browseListings({
      first: Math.min(100, Math.max(limit * 2, 30)),
      skip: skipSubgraph,
      orderBy: "listingId",
      orderDirection: "desc",
      enrich: false,
    });

    const ids = listings.map((l) => String(l.listingId));
    const existing = await getListingPreviewsByIds(ids);
    const now = Date.now();

    const needWork = listings
      .filter((l) => {
        const id = String(l.listingId);
        const row = existing.get(id);
        if (!row) return true;
        if (!row.imageUrl && !row.thumbnailSmallUrl) return true;
        if (now - row.updatedAt.getTime() > STALE_MS) return true;
        return false;
      })
      .slice(0, limit);

    let succeeded = 0;
    let failed = 0;

    await mapPool(needWork, CONCURRENCY, async (listing: EnrichedAuctionData) => {
      if (!listing.tokenAddress || listing.tokenId === undefined || listing.tokenId === null) {
        return;
      }
      try {
        const metadata = await fetchNFTMetadata(
          listing.tokenAddress as Address,
          listing.tokenId,
          listing.tokenSpec,
        );
        let thumbnailSmallUrl: string | null = metadata?.image ?? null;
        if (metadata?.image) {
          try {
            const { getOrGenerateThumbnail } = await import(
              "~/lib/server/thumbnail-generator"
            );
            thumbnailSmallUrl = await getOrGenerateThumbnail(metadata.image, "small");
          } catch {
            thumbnailSmallUrl = metadata.image;
          }
        }
        await upsertListingPreview({
          listingId: String(listing.listingId),
          tokenAddress: String(listing.tokenAddress),
          tokenId: String(listing.tokenId),
          imageUrl: metadata?.image ?? null,
          thumbnailSmallUrl,
          title: metadata?.title || metadata?.name || null,
        });
        succeeded++;
      } catch {
        failed++;
      }
    });

    return NextResponse.json({
      ok: true,
      subgraphRows: listings.length,
      attempted: needWork.length,
      succeeded,
      failed,
      skip: skipSubgraph,
    });
  } catch (e) {
    console.error("[cron/listing-previews]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
