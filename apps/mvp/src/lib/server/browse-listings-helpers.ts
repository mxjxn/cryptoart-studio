/**
 * Pure helpers for market browse. Kept separate so tests can import them without
 * pulling subgraph / Next server modules.
 */

/** Only enrich the page of listings we will return — never the over-fetched subgraph window. */
export function listingsForEnrichment<T>(activeListings: T[], first: number): T[] {
  if (first <= 0) return [];
  return activeListings.slice(0, first);
}

export const BROWSE_STREAM_ENRICH_BATCH = 4;
