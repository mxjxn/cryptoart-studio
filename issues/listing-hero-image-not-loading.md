# Listing detail hero image never loads; fullscreen overlay works fine

## Summary

On the listing detail page (`/listing/[listingId]`), the hero image in the `<MediaDisplay>` component never loads — it stays as a pulsating gray placeholder (`animate-pulse bg-[#1a1a1a]`). However, clicking the unloaded area opens the `<ImageOverlay>` fullscreen view, **which loads the image successfully**. Market page thumbnails (`AuctionCard`) also load fine.

## Reproduction

1. Navigate to any listing detail page (e.g., `/listing/123`)
2. Observe the hero section — pulsating gray skeleton, image never appears
3. Click the skeleton area
4. Fullscreen overlay opens and the image loads correctly
5. Go to `/market` — thumbnail cards load images fine

## Expected behavior

The hero image on the listing detail page should load and display at web resolution, transitioning from the pulse skeleton to the actual image via the opacity fade (`opacity-0` → `opacity-100` on `onLoad`).

## Root cause analysis

The issue is in the image URL pipeline. Two different URL sources are used:

### Market page (works)
`AuctionCard` → `auction.thumbnailUrl` (the "small" thumbnail, server-generated via `/api/...` or a proxied thumbnail URL)

### Listing detail hero (broken)
`AuctionDetailClient` → `listingHeroImageUrl` = `auction.detailThumbnailUrl ?? auction.thumbnailUrl ?? auction.image`

**The `detailThumbnailUrl` is preferred for the hero.** It's generated in `listing-enrichment-capped.ts`:
- Line 39: `detailThumbnailUrl = (await getCachedThumbnail(image, "detail")) ?? undefined`
- If not cached, it's generated in the **background** (fire-and-forget `void (async () => ...)` on line 41)
- If generation hasn't completed or the background job failed, `detailThumbnailUrl` is `undefined` → falls through to `thumbnailUrl` → falls through to raw `auction.image`

### Fullscreen overlay (works)
`ImageOverlay` → `listingFullscreenImageUrl` = `auction.detailThumbnailUrl ?? auction.image ?? auction.thumbnailUrl`
Plus `fallbackSrcs` from `useAuctionDetail` line 280-281: `[auction.thumbnailUrl, auction.detailThumbnailUrl]` — the overlay has multiple fallback sources.

## Likely failure modes

1. **`detailThumbnailUrl` points to a slow/failing thumbnail endpoint** — the `<img>` `onLoad` event never fires, so it stays at `opacity-0` with the pulse skeleton behind it. The `onError` handler would swap to the gradient placeholder, but if the request is **hanging** (not failing), neither `onLoad` nor `onError` fires.

2. **IPFS gateway rewrite issue** — `rewritePublicIpfsUrlForClient()` rewrites `ipfs://` and `/ipfs/` URLs to the configured gateway. If `NEXT_PUBLIC_PINATA_GATEWAY_URL` or `NEXT_PUBLIC_IPFS_GATEWAY_URL` is misconfigured or the gateway is rate-limiting/slow, the browser request hangs. The fullscreen overlay may use a different URL path or have a different CORS/loading behavior.

3. **`detailThumbnailUrl` is a server-side proxy URL** that requires auth or is only accessible server-side (e.g., an internal thumbnail cache route), while the fullscreen overlay falls back to the raw IPFS URL which works from the browser.

4. **CORS blocking** — if the detail thumbnail URL is on a different origin without proper CORS headers, the `<img>` may load visually but the browser suppresses the `onLoad` event (less likely for plain `<img>`, more relevant for canvas operations, but worth checking).

## Relevant files

- `apps/mvp/src/components/media/MediaDisplay.tsx` — The component with the `opacity-0`/`onLoad` pattern and pulse skeleton
- `apps/mvp/src/hooks/useAuctionDetail.ts` — Lines 1717-1720 define `listingHeroImageUrl` and `listingFullscreenImageUrl`
- `apps/mvp/src/lib/server/listing-enrichment-capped.ts` — Lines 26-53 generate `detailThumbnailUrl`
- `apps/mvp/src/lib/ipfs-gateway-public-url.ts` — `rewritePublicIpfsUrlForClient()` rewrites URLs for browser use
- `apps/mvp/src/components/AuctionCard.tsx` — Market page cards that work correctly (uses `thumbnailUrl`)
- `apps/mvp/src/components/ImageOverlay.tsx` — Fullscreen overlay that loads correctly (has fallback sources)

## Debugging steps

1. Open browser DevTools Network tab on a listing detail page
2. Check if the hero `<img>` `src` URL returns a response (200, 403, CORS error, or pending/hanging?)
3. Compare the hero `src` URL against the fullscreen overlay image `src` — are they different URLs?
4. Check if `detailThumbnailUrl` is `undefined` (meaning `thumbnailUrl` or raw `image` is being used instead)
5. Test if the raw `auction.image` URL (before gateway rewrite) loads in a new browser tab
6. Check server logs for thumbnail generation failures: `[listing-enrichment] Background detail thumbnail failed`

## Suggested fixes to investigate

- Add a **load timeout** in `MediaDisplay` — if `onLoad` hasn't fired after N seconds, try the next URL in the fallback chain
- Add `onError` logging to see if the image request is failing silently
- Ensure `detailThumbnailUrl` falls back gracefully to `thumbnailUrl` or raw `image` on the client side (not just server-side)
- Consider adding the same multi-source fallback pattern from `ImageOverlay` to the hero `MediaDisplay`
