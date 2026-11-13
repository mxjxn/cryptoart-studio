# Cryptoart Social — social-first layout

Updated November 2, 2026. Layout sketch after reviewing [objkt.com/social](https://objkt.com/social). Supersedes the three peer-tab IA in `docs/plans/2026-10-29-social-product-and-implementation.md` where they conflict. Product decisions in that plan (posts, Hypersnap, Studio split, channels out) still hold.

## Positioning

Objkt is a marketplace with a social mode at `/social`. Cryptoart is the inverse: the product is conversation; the marketplace is tightly integrated into that conversation. The TLD is `.social`. Home is the feed.

### Feed scope (Nov 2)

Do **not** limit the Hypersnap stream to art channels or app-only posts. Like Objkt: show the social network, and add marketplace features onto posts when they attach or reference work.

| Viewer | Stream |
| --- | --- |
| Logged out | Curated Hypersnap feed (trending + Cryptoart ranking/curator weights) |
| Logged in (FID known) | Personal following feed **mixed** with the curated feed |

Channel browsing UI stays out. Eligibility is no longer “approved channel only.”

## Zones (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  CRYPTOART          [ Search ⌘K ]           Wallet · Compose │
│  Feed · Market · Studio↗                                     │
├──────────────┬────────────────────────┬─────────────────────┤
│              │                        │                     │
│  ACTIVITY    │   CONVERSATION         │   CREATE            │
│  (rail)      │   (primary)            │   (rail)            │
│              │                        │                     │
│  Live / Sold │   chronological posts  │   Studio callout    │
│  Selected    │   full Hypersnap       │   mint · Arweave    │
│  (curated    │   curated / following  │                     │
│   fallback)  │   ± NFT attach         │   On the way:       │
│              │                        │   lazy mint,        │
│              │   heart / recast /     │   Clanker coins,    │
│              │   reply                │   STP subs          │
│              │                        │                     │
│              │                        │   On view           │
│              │                        │   (exhibition)      │
└──────────────┴────────────────────────┴─────────────────────┘
```

Mobile collapses to: top chrome → optional collapse “On view / Live” strip → feed. Market remains its own page. Left identity collapses into chrome / account menu.

## What lives where

| Need | Lives in | Not |
| --- | --- | --- |
| Reading / posting conversation | Center column on `/` | Mixed as equal siblings with inventory grids |
| Current exhibition | Right rail “On view”; full page at `/exhibitions/:id` | A peer “Featured” tab that restarts the product |
| Live auctions / listings glance | Right rail (small set) | Full inventory in the feed |
| Exhaustive browse + filters | `/market` | Interleaved into `/` as a second homepage |
| Listing / artwork detail | `/listing/...`, `/artwork/...` | Modal-only; keep shareable URLs |
| Compose | `/compose` (or slide-over later); waits on Hypersnap write verify | Fake success; imported FC composer |
| Mint / deploy | Link out to Studio | A Social tab |
| Admin / curator tools | `/admin/...` | Main bar for collectors |

## Routes

| Route | Role |
| --- | --- |
| `/` | Feed desk (conversation + rails). Default landing. |
| `/market` | Chronological inventory (+ published exhibitions when merge exists). Filters, pagination. |
| `/market/all` | Redirect → `/market` |
| `/feed` | Redirect → `/` (keep temporarily for bookmarks) |
| `/exhibitions/:id` | Full exhibition |
| `/listing/:chain/:id` | Listing detail / bid / buy |
| `/artwork/:chain/:contract/:tokenId` | Artwork identity independent of sale state |
| `/compose` | Post composer (after write path verified) |
| `/admin/*` | Editorial / curator |

Global chrome labels: **Feed** · **Market** · wallet · Compose when ready. No Featured / Galleries / Create listing in the main bar. Create listing stays reachable from a work or inventory context.

## How this differs from Objkt (intentionally)

- Their center is social *inside* a market shell; ours *is* the shell.
- Their left rail is mature graph discovery (creators, tags, collections). Ours stays thin until we have real Hypersnap graph signal — do not invent leaderboards.
- Their Buy CTA on every post is correct to copy when an attach is listed. View always; Buy/Bid only when there is a live listing.
- Their “Featured exhibitions” sit in a side rail. Ours do too — that replaces the Featured tab.

## How this differs from the Oct 29 three-tab plan

| Oct 29 | This sketch |
| --- | --- |
| Featured / Market / Feed as peer tabs | Feed is home; Market is browse; Featured dissolves into the rail |
| Feed mixes posts + listings + exhibitions as stream peers | Feed is posts; market facts appear on attaches and in the rail |
| Featured as possible default landing | `/` is the conversation |

Market page purpose unchanged: exhaustive chronology. Exhibition editorial placement moves from a landing tab into the rail + exhibition pages.

## Empty and sparse states

Until app-owned posts exist, `/` shows an empty conversation column and a populated market rail. Do not pad the center with auction/listing card stacks — that recreated the navigability problem. A single optional “From the market” teaser under the empty state (one row, link to `/market`) is allowed; a grid is not.

## Acceptance for the layout slice

1. `/` is the feed desk: conversation center, market rail, thin identity/chrome.
2. `/market` is inventory only; `/feed` redirects home.
3. Main bar is Feed · Market (plus wallet / admin where appropriate).
4. Exhibition “on view” appears in the rail without requiring a Featured tab.
5. Listing grids do not occupy the conversation column.
6. Desktop three-zone; mobile feed-first with rail as a compact strip or secondary screen.

## Out of scope for this sketch

Hypersnap write verification, composer UI, exhibition service choice, curator fees, deleting the imported Farcaster tree, production deploy.

**Follow-on:** cast signing / compose for **web**, with native iOS/Android tagged later — [2026-11-13-hypersnap-signer-and-clients.md](./2026-11-13-hypersnap-signer-and-clients.md).
