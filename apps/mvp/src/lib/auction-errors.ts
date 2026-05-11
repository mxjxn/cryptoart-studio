export const AMBIGUOUS_LISTING_CODE = "AMBIGUOUS_LISTING_ID" as const;

/** Parsed from `GET /api/auctions/:id` 409 JSON when present. */
export function parseAmbiguousChainsFromBody(body: unknown): number[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { chains?: unknown }).chains;
  if (!Array.isArray(raw)) return [];
  const nums = raw
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n): n is number => Number.isFinite(n));
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function chainIdsFromSubgraphRows(rows: { chainId?: unknown }[]): number[] {
  const nums = rows.map((row) => {
    const c = row.chainId;
    if (typeof c === "number" && Number.isFinite(c)) return c;
    const p = parseInt(String(c ?? ""), 10);
    return Number.isFinite(p) ? p : NaN;
  });
  return [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

export class AmbiguousListingError extends Error {
  readonly code = AMBIGUOUS_LISTING_CODE;
  readonly status = 409 as const;

  constructor(
    public readonly listingId: string,
    public readonly chains: number[]
  ) {
    super(
      `Listing #${listingId} exists on more than one network — specify chainId or open a chain-specific URL.`
    );
    this.name = "AmbiguousListingError";
  }
}

export function isAmbiguousListingError(e: unknown): e is AmbiguousListingError {
  return e instanceof AmbiguousListingError;
}
