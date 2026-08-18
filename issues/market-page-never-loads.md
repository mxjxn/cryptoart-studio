# /market never loads — unbounded subgraph waits + fully live per-request resolution (snapshot table never read)

## Symptom

`/market` shows the skeleton (loading.tsx) forever. Historically it has been slow since the SSR revamp (`e2cb72c`, 2026-06-23), but it now never completes at all. Content changes rarely (few new listings), yet every render re-resolves everything live.

## What one page load actually does

`apps/mvp/src/app/market/page.tsx` → `getInitialPayload()` runs `Promise.all([browseListings(...), resolveMarketSections(false)])` — the page waits for the **slowest** of these:

### 1. `browseListings({ first: 20, enrich: true, marketBrowseMode })`
- `queryListingsAcrossChains(BROWSE_LISTINGS_QUERY, { first: 80 })` — fetches **80 listings per endpoint** (Base + mainnet when configured)
- The GraphQL query includes **`bids(orderBy: amount, first: 1000)` per listing** (`browse-listings.ts:117`) — up to 80 × 1000 bid objects per endpoint per render
- Each endpoint call goes through `retrySubgraphRequest` = up to 4 attempts with 1s/2s/4s backoff

### 2. `resolveMarketSections(false)` → `resolveLayoutSections("market")`
Per configured section, **in parallel but each unbounded**:
- `recently_concluded`, `live_bids`, `ending_soon`, `awaiting_bids` each run their own `queryListingsAcrossChains` (more 80–200-row multi-chain queries)
- `getUpcomingAuctions` → `fetchActiveAuctionsUncached(limit * 2, 0, true)` — explicitly uncached subgraph read
- `getGalleryListings` performs a **self-fetch to its own `/api/curation/slug/...` with no timeout** (`homepage-layout.ts:617`)
- `featured_carousel` does per-listing `getAuctionServer` (RPC reads) + DB queries

### 3. The half-built piece: `marketLayoutSnapshots` is never read
- `packages/db/src/schema.ts:522` defines `market_layout_snapshots`
- Vercel cron `refresh-market-layout` runs **every 20 minutes** and writes the fully-resolved sections payload into it (`api/cron/refresh-market-layout/route.ts`)
- **No application code reads this table.** The market page resolves everything live per request instead. The cheap read path was built but never wired in.

## Why it hangs forever instead of just being slow

1. **No request timeout anywhere.** `graphql-request` is called with no `AbortSignal` (`subgraph-multi-query.ts:142`), and graphql-request has **no default timeout**. A degraded Graph indexer that accepts the connection but never completes the response blocks the request indefinitely. `Promise.allSettled` then never settles → `getInitialPayload` never settles → skeleton forever.
2. **Retries only trigger on errors, not slowness.** `retrySubgraphRequest` classifies by error message (`timeout`, `ECONNRESET`, …) — a hung-but-alive connection produces no error, so no retry, no bail.
3. **`revalidate = 120` provides almost no protection.** The page `await searchParams` (`sp.mode ?? sp.tab`), which opts the route into dynamic rendering — the ISR window doesn't pre-render/serve the HTML from the full route cache. Every request pays the full pipeline.
4. **Client-side loop mode:** if SSR eventually returns with `subgraphDown: true` or 0 listings, `MarketClient` starts with `loading = true` and its effect fetches `/api/listings/browse?...&stream=true` — the **same** unbounded pipeline again (`MarketClient.tsx:115`). Failure either way = permanent spinner.
5. In-flight dedup (`inFlightBrowse`) means concurrent visitors share one hung promise — everyone waits together.

**To confirm the trigger in production:** check Vercel logs for `[Browse Listings] Fetching from subgraphs:` lines with no matching `[Browse Listings] Merged listings:` line (or `[Homepage] Resolved section ... in Xms` lines absent) → the endpoint in flight is the one hanging.

## Proposed fixes (tiered)

### A. Wire in the snapshot read path (the big win — matches "rarely changes")
- Market page reads `market_layout_snapshots` (single DB row read, ~ms) and renders sections/hero from it.
- The existing 20-min cron keeps it warm — it's already deployed and running.
- Fallback: if the snapshot is missing or older than e.g. 1h, fall back to live `resolveMarketSections`.
- Optionally snapshot the browse listings slice the same way (or wrap `browseListings`' market-mode result in `unstable_cache({ revalidate: 120 })`).

Expected result: `/market` HTML in <100ms regardless of subgraph health.

### B. Bound every external wait (defense in depth)
- Wrap all `graphql-request` calls with `AbortSignal.timeout(5000)` (pass a custom fetch or signal) — one hung endpoint then costs 5s, not infinity.
- Apply the same to the `getGalleryListings` self-fetch and the featured-carousel RPC reads.
- Cap total retry budget per request (currently 4 attempts × per-endpoint, multiplied across ~6–10 queries per render).

### C. Cut query weight
- `bids(first: 1000)` in `BROWSE_LISTINGS_QUERY` is only used to derive `bidCount` + `highestBid` — the top bid. Reduce to `first: 1` (highest by amount is already first) or use a subgraph aggregate. This shrinks payloads by orders of magnitude.
- Consider whether market mode needs 80 rows pre-filter (the 5x over-fetch for status filtering) now that hidden/ended listings are few.

### D. UX safety net
- `loading.tsx` / `MarketClient`: after ~10s of no progress, show a "Taking longer than usual — retry" state instead of a silent skeleton, so endpoint degradation is visible instead of looking like a dead app.

## Relevant files

- `apps/mvp/src/app/market/page.tsx` — SSR entry, `Promise.all`, dead `revalidate`
- `apps/mvp/src/lib/server/browse-listings.ts:97` — `BROWSE_LISTINGS_QUERY` (bids ×1000), `:415` fetchCount logic
- `apps/mvp/src/lib/server/subgraph-multi-query.ts:126` — `queryListingsAcrossChains` (no timeout), `:15` retry logic
- `apps/mvp/src/lib/server/homepage-layout.ts` — section resolution, `:617` un-timed self-fetch
- `apps/mvp/src/app/api/cron/refresh-market-layout/route.ts` — cron writing the never-read snapshot
- `packages/db/src/schema.ts:522` — `market_layout_snapshots`
- `apps/mvp/src/app/market/MarketClient.tsx:115` — client-side re-fetch loop on degraded SSR
