import { getDatabase, listingMediaPreview, inArray } from "@cryptoart/db";
import type { ListingMediaPreviewData } from "@cryptoart/db";
import { generateThumbnailsBackground } from "~/lib/server/background-thumbnails";

export type UpsertListingPreviewInput = {
  listingId: string;
  tokenAddress: string;
  tokenId: string;
  imageUrl?: string | null;
  thumbnailSmallUrl?: string | null;
  title?: string | null;
};

const ID_CHUNK = 80;

/** Namespaces a listing preview key to avoid collisions across chains. */
export function makeListingPreviewId(chainId: number | undefined, listingId: string): string {
  if (chainId == null) return listingId;
  return `${chainId}-${listingId}`;
}

/**
 * Persist preview row for market merge. Fire-and-forget safe — swallows errors.
 * Optionally kicks background thumbnail generation when we have an image but no small thumb URL.
 */
export async function upsertListingPreview(input: UpsertListingPreviewInput): Promise<void> {
  const {
    listingId,
    tokenAddress,
    tokenId,
    imageUrl,
    thumbnailSmallUrl,
    title,
  } = input;

  if (!listingId || !tokenAddress || !tokenId) return;

  const db = getDatabase();
  if (!db) return;

  const now = new Date();

  try {
    await db
      .insert(listingMediaPreview)
      .values({
        listingId,
        tokenAddress: tokenAddress.toLowerCase(),
        tokenId: String(tokenId),
        imageUrl: imageUrl ?? null,
        thumbnailSmallUrl: thumbnailSmallUrl ?? null,
        title: title ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: listingMediaPreview.listingId,
        set: {
          tokenAddress: tokenAddress.toLowerCase(),
          tokenId: String(tokenId),
          imageUrl: imageUrl ?? null,
          thumbnailSmallUrl: thumbnailSmallUrl ?? null,
          title: title ?? null,
          updatedAt: now,
        },
      });

    if (imageUrl && !thumbnailSmallUrl) {
      generateThumbnailsBackground(imageUrl, listingId, ["small"]).catch(() => {});
    }
  } catch (e) {
    console.warn("[listing-preview-store] upsert failed:", e);
  }
}

function rowToData(row: typeof listingMediaPreview.$inferSelect): ListingMediaPreviewData {
  return {
    listingId: row.listingId,
    tokenAddress: row.tokenAddress,
    tokenId: row.tokenId,
    imageUrl: row.imageUrl ?? null,
    thumbnailSmallUrl: row.thumbnailSmallUrl ?? null,
    title: row.title ?? null,
    updatedAt: row.updatedAt,
  };
}

/**
 * Batch load previews for browse merge. Returns Map listingId -> row.
 */
export async function getListingPreviewsByIds(
  listingIds: string[],
): Promise<Map<string, ListingMediaPreviewData>> {
  const out = new Map<string, ListingMediaPreviewData>();
  if (listingIds.length === 0) return out;

  const db = getDatabase();
  if (!db) return out;

  const unique = [...new Set(listingIds.filter(Boolean))];

  try {
    for (let i = 0; i < unique.length; i += ID_CHUNK) {
      const chunk = unique.slice(i, i + ID_CHUNK);
      const rows = await db
        .select()
        .from(listingMediaPreview)
        .where(inArray(listingMediaPreview.listingId, chunk));

      for (const row of rows) {
        out.set(row.listingId, rowToData(row));
      }
    }
  } catch (e) {
    console.warn("[listing-preview-store] batch read failed:", e);
  }

  return out;
}
