import type { EnrichedAuctionData } from "~/lib/types";

export type BrowseStreamMetadata = {
  count?: number;
  subgraphDown?: boolean;
  degraded?: boolean;
  hasMore?: boolean;
};

/**
 * Incrementally parses the JSON body produced by GET /api/listings/browse?stream=true.
 * Handles chunked transfer and nested braces/strings inside listing objects.
 */
export async function consumeBrowseListingsStream(
  response: Response,
  options?: {
    signal?: AbortSignal;
    onListing?: (listing: EnrichedAuctionData, accumulated: EnrichedAuctionData[]) => void;
  }
): Promise<{ listings: EnrichedAuctionData[]; metadata: BrowseStreamMetadata }> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const listings: EnrichedAuctionData[] = [];
  const metadata: BrowseStreamMetadata = {};
  let listingsArrayStart = -1;

  const dedupePush = (listing: EnrichedAuctionData) => {
    if (!listing.listingId) return;
    if (listings.some((l) => l.listingId === listing.listingId)) return;
    listings.push(listing);
    options?.onListing?.(listing, listings);
  };

  try {
    while (true) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (listingsArrayStart === -1) {
        const arrayStart = buffer.indexOf('"listings":[');
        if (arrayStart !== -1) {
          listingsArrayStart = arrayStart + 11;
        }
      }

      if (listingsArrayStart === -1) continue;

      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let startIdx = -1;
      const listingsPart = buffer.substring(listingsArrayStart);

      for (let i = 0; i < listingsPart.length; i++) {
        const char = listingsPart[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") {
            if (braceCount === 0) startIdx = i;
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
              try {
                const listingJson = listingsPart.substring(startIdx, i + 1);
                const listing = JSON.parse(listingJson) as EnrichedAuctionData;
                dedupePush(listing);
              } catch {
                /* partial JSON */
              }
              startIdx = -1;
            }
          } else if (char === "]" && braceCount === 0) {
            const afterArray = buffer.substring(listingsArrayStart + i);
            const countMatch = afterArray.match(/"count":(\d+)/);
            if (countMatch) metadata.count = parseInt(countMatch[1], 10);
            const subgraphMatch = afterArray.match(/"subgraphDown":(true|false)/);
            if (subgraphMatch) metadata.subgraphDown = subgraphMatch[1] === "true";
            const degradedMatch = afterArray.match(/"degraded":(true|false)/);
            if (degradedMatch) metadata.degraded = degradedMatch[1] === "true";
            const hasMoreMatch = afterArray.match(/"hasMore":(true|false)/);
            if (hasMoreMatch) metadata.hasMore = hasMoreMatch[1] === "true";
            break;
          }
        }
      }

      if (startIdx !== -1 && startIdx < listingsPart.length) {
        buffer = buffer.substring(0, listingsArrayStart + startIdx);
      } else {
        const lastProcessedIdx = listingsPart.lastIndexOf("}");
        if (lastProcessedIdx !== -1) {
          buffer = buffer.substring(0, listingsArrayStart + lastProcessedIdx + 1);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }

  try {
    const finalData = JSON.parse(buffer) as {
      listings?: EnrichedAuctionData[];
      subgraphDown?: boolean;
      degraded?: boolean;
      pagination?: { hasMore?: boolean };
    };
    if (finalData.listings && Array.isArray(finalData.listings)) {
      finalData.listings.forEach((l) => dedupePush(l));
    }
    if (finalData.subgraphDown !== undefined) metadata.subgraphDown = finalData.subgraphDown;
    if (finalData.degraded !== undefined) metadata.degraded = finalData.degraded;
    if (finalData.pagination?.hasMore !== undefined) metadata.hasMore = finalData.pagination.hasMore;
  } catch {
    /* buffer may be slice-only */
  }

  return { listings, metadata };
}
