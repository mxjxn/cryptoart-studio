import { request } from "graphql-request";
import {
  BASE_CHAIN_ID,
  getConfiguredSubgraphEndpoints,
} from "~/lib/server/subgraph-endpoints";

export function listingsSubgraphHeaders(): Record<string, string> {
  const apiKey = process.env.GRAPH_STUDIO_API_KEY;
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
}

export async function retrySubgraphRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: unknown) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable =
        errorMessage.includes("bad indexers") ||
        errorMessage.includes("BadResponse") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("network") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT");

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      console.log(
        `[SubgraphMulti] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})…`,
        errorMessage
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/** Ensure `chainId` is set when the subgraph row omits it (use deployment chain). */
export function ensureListingChainId<T extends { chainId?: number }>(
  listing: T,
  endpointChainId: number
): T & { chainId: number } {
  const cid = listing.chainId;
  if (typeof cid === "number" && Number.isFinite(cid)) {
    return listing as T & { chainId: number };
  }
  return { ...listing, chainId: endpointChainId };
}

export function dedupeListingsByChainAndId(listings: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const l of listings) {
    const cid =
      typeof l.chainId === "number" && Number.isFinite(l.chainId)
        ? l.chainId
        : BASE_CHAIN_ID;
    const key = `${cid}:${String(l.listingId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...l, chainId: cid });
  }
  return out;
}

function cmpBigStringField(a: unknown, b: unknown): number {
  try {
    const bnA = BigInt(String(a ?? "0"));
    const bnB = BigInt(String(b ?? "0"));
    if (bnA < bnB) return -1;
    if (bnA > bnB) return 1;
    return 0;
  } catch {
    return 0;
  }
}

/** Global ordering after merging multiple subgraphs (per-chain ordering is not enough). */
export function sortMergedListingsForBrowse(
  listings: any[],
  orderBy: string,
  orderDirection: "asc" | "desc"
): void {
  const field =
    orderBy === "listingId"
      ? "listingId"
      : orderBy === "updatedAt"
        ? "updatedAt"
        : "createdAt";
  const dir = orderDirection === "asc" ? 1 : -1;
  listings.sort((a, b) => {
    const c = cmpBigStringField(a[field], b[field]) * dir;
    if (c !== 0) return c;
    const ca =
      typeof a.chainId === "number" && Number.isFinite(a.chainId)
        ? a.chainId
        : BASE_CHAIN_ID;
    const cb =
      typeof b.chainId === "number" && Number.isFinite(b.chainId)
        ? b.chainId
        : BASE_CHAIN_ID;
    return ca - cb;
  });
}

export type ListingsQueryRow = { listings?: any[] };

/**
 * Run the same listings GraphQL document against every configured auctionhouse subgraph,
 * tag rows with `chainId`, concatenate, dedupe by (chainId, listingId).
 */
export async function queryListingsAcrossChains(
  document: string,
  variables: Record<string, unknown>
): Promise<{
  listings: any[];
  anyEndpointSucceeded: boolean;
  maxEndpointListingCount: number;
}> {
  const endpoints = getConfiguredSubgraphEndpoints();
  const headers = listingsSubgraphHeaders();
  const merged: any[] = [];
  let maxEndpointListingCount = 0;

  const settled = await Promise.allSettled(
    endpoints.map((ep) =>
      retrySubgraphRequest(() =>
        request<ListingsQueryRow>(ep.url, document, variables, headers)
      )
    )
  );

  let anyEndpointSucceeded = false;
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") {
      console.warn("[SubgraphMulti] Endpoint failed:", endpoints[i]?.chainId, s.reason);
      return;
    }
    anyEndpointSucceeded = true;
    const ep = endpoints[i];
    const rows = s.value.listings ?? [];
    maxEndpointListingCount = Math.max(maxEndpointListingCount, rows.length);
    for (const row of rows) {
      merged.push(ensureListingChainId(row, ep.chainId));
    }
  });

  return {
    listings: dedupeListingsByChainAndId(merged),
    anyEndpointSucceeded,
    maxEndpointListingCount,
  };
}

/** Sort merged rows by a single numeric-ish field (e.g. updatedAt, endTime). */
export function sortMergedListingsByField(
  listings: any[],
  field: string,
  orderDirection: "asc" | "desc"
): void {
  const dir = orderDirection === "asc" ? 1 : -1;
  listings.sort((a, b) => {
    const c = cmpBigStringField(a[field], b[field]) * dir;
    if (c !== 0) return c;
    const ca =
      typeof a.chainId === "number" && Number.isFinite(a.chainId)
        ? a.chainId
        : BASE_CHAIN_ID;
    const cb =
      typeof b.chainId === "number" && Number.isFinite(b.chainId)
        ? b.chainId
        : BASE_CHAIN_ID;
    return ca - cb;
  });
}
