# Temporal API Migration Plan

## Why

The native `Date` object is a 1995 relic — mutable, 0-indexed months, no timezone awareness,
no Duration type, janky parsing. The new `Temporal` API (TC39 Stage 4, shipping in Chrome 144+,
Firefox 139+, Node 26) fixes all of it.

**Current state:** 143 `new Date()`, 133 `Date.now()`, 40 `.getTime()`, 57 manual getters,
15 mutator calls, 1 `.getTimezoneOffset()` — all raw `Date`. Zero third-party date libs.

**Target:** Replace all `Date` usage with `Temporal` types. One polyfill (`temporal-polyfill`,
~20 kB gzip, production-grade from FullCalendar) for Safari + older browsers.

---

## Rule of Thumb

**Never mix `Temporal` and `Date` in the same module.** Pick one. Convert a file entirely
or leave it alone until you're ready to convert it.

---

## Polyfill Strategy

```
npm install temporal-polyfill
```

- **Non-global import** for new code: `import { Temporal } from 'temporal-polyfill'`
- **Global import** for gradual migration: `import 'temporal-polyfill/global'` (adds
  `Temporal` to `globalThis`; no-op once native support is universal)
- Conditional load in Astro layout: detect `typeof Temporal === 'undefined'` and
  dynamically import the polyfill client-side only
- Server-side (Node 26+): native, no polyfill needed

---

## Migration Phases

### Phase 1: Foundation + Hot Path

Install polyfill, create shared helpers, convert the most impactful files.

| File | What it does | Temporal type |
|------|-------------|---------------|
| `lib/share-text.ts` | Formats auction end time for cast text (has the 1970 bug) | `Temporal.Instant` |
| `lib/time-utils.ts` | Core time formatting — `formatTimeRemaining`, `formatPreOpenAuctionTiming`, `getListingDisplayStatus` | `Temporal.Instant`, `Temporal.Duration` |
| `lib/datetime-local-utc.ts` | Timezone offset handling, datetime-local string parsing | `Temporal.PlainDateTime`, `Temporal.Now.timeZone()` |
| `hooks/useCountdown.ts` | Countdown timer, `Date.now()` epoch seconds | `Temporal.Now.instant()` |
| `hooks/useAuctionDetail.ts` | Auction timing state, `Date.now()` + `new Date()` for time-ago | `Temporal.Instant` |

**Why these first:** share-text.ts is already buggy. time-utils.ts is imported by everything
— converting it unlocks the rest. The hooks are the hot path for auction display.

### Phase 2: Create Listing Flow

All the datetime-local picker formatting and validation.

| File | What it does | Temporal type |
|------|-------------|---------------|
| `components/create-listing/DateSelector.tsx` | 8 `new Date`, 23 getters, 4 setters — the worst file | `Temporal.PlainDateTime` |
| `components/create-listing/ERC721AuctionConfigPage.tsx` | Start/end datetime parsing | `Temporal.PlainDateTime` |
| `components/create-listing/ERC1155ConfigPage.tsx` | Same pattern | `Temporal.PlainDateTime` |
| `components/create-listing/ERC721FixedPriceConfigPage.tsx` | Same pattern | `Temporal.PlainDateTime` |
| `app/create/CreateAuctionClient.tsx` | Default times, validation, datetime-local → UTC | `Temporal.PlainDateTime`, `Temporal.Instant` |
| `components/UpdateListingForm.tsx` | Datetime-local parse/format | `Temporal.PlainDateTime` |

**Why:** This is where the `new Date()` mutation bugs live — `setHours()`, `setDate()`,
`setMonth()` causing silent overflows. Temporal's immutable `.with()` and `.add()` eliminate
this class of bug entirely.

### Phase 3: Server-Side Routes

API routes and cron jobs — these run on Node 26+ (native Temporal), polyfill is optional.

| File | What it does | Temporal type |
|------|-------------|---------------|
| `app/api/cron/calculate-stats/route.ts` | Period date arithmetic (daily/weekly/monthly/yearly) | `Temporal.PlainDate`, `Temporal.Duration` |
| `app/api/cron/cleanup-cache/route.ts` | Cache expiration comparisons | `Temporal.Instant` |
| `app/api/cron/featured-refresh/route.ts` | Hours-since-last-refresh computation | `Temporal.Instant`, `Temporal.Duration` |
| `app/api/listings/[listingId]/page-status/route.ts` | Heavy timestamp usage (24 `new Date()`) | `Temporal.Instant` |
| `app/api/market-layout/route.ts` | Cache age + `updatedAt` DB writes | `Temporal.Instant` |
| `app/api/tokens/[address]/image/route.ts` | 30-day expiry computation | `Temporal.Instant`, `Temporal.Duration` |
| `lib/server/user-cache.ts` | 18 timestamp operations | `Temporal.Instant` |
| `lib/server/notification-events.ts` | Time-range queries with duration math | `Temporal.Instant` |

**Why server-side:** The `calculate-stats` cron uses 4 mutator calls to subtract periods
(`setDate(1)`, `setMonth(month-1)`, etc.) — Temporal's `plainDate.subtract({ months: 1 })`
is both correct and readable. Server runs Node 26+, zero polyfill overhead.

### Phase 4: Display + Admin

Formatting timestamps for human consumption.

| File | What it does | Temporal type |
|------|-------------|---------------|
| `app/listing/[listingId]/AuctionDetailClient.tsx` | `.toLocaleString()` for auction times | `Temporal.Instant.toLocaleString()` |
| `app/gallery/*/PublicGalleryClient.tsx` (3 variants) | `.toLocaleDateString()` for gallery dates | `Temporal.PlainDate.toLocaleString()` |
| `app/notifications/NotificationsClient.tsx` | Time-ago computation | `Temporal.Instant.since()` |
| `app/curate/CurateClient.tsx` | Gallery date display | `Temporal.PlainDate` |
| `app/admin/*/page.tsx` (4 files) | Admin date formatting | `Temporal.Instant.toLocaleString()` |
| `hooks/useNotifications.ts` | Optimistic `readAt` | `Temporal.Now.instant()` |
| `hooks/useMembershipStatus.ts` | Expiration date from seconds | `Temporal.Instant`, `Temporal.Duration` |
| `components/ProfileDropdown.tsx` | Date display | `Temporal.Instant` |

### Phase 5: Niche / Low Priority

| File | What it does | Temporal type |
|------|-------------|---------------|
| `lib/kismet-casa-schedule.ts` | Wall-clock scheduling with next-day rollover | `Temporal.PlainTime`, `Temporal.PlainDateTime` |
| `lib/share-image-processor.ts` | Log timestamps | `Temporal.Now.instant()` |
| `lib/server/image-cache.ts` | Cache entry dates | `Temporal.Instant` |
| `lib/server/thumbnail-cache.ts` | Cache entry dates | `Temporal.Instant` |
| `components/ShareImageCookingModal.tsx` | Status timestamps | `Temporal.Now.instant().toString()` |
| Various `app/api/admin/*/route.ts` | `updatedAt: new Date()` DB writes | `Temporal.Now.instant()` |

---

## Key Patterns: Before → After

### Getting current unix seconds
```js
// Before
const now = Math.floor(Date.now() / 1000);
// After
const now = Temporal.Now.instant().epochSeconds;
```

### Formatting a timestamp
```js
// Before
new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
// After
Temporal.Instant.fromEpochSeconds(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
```

### Adding duration
```js
// Before (mutation + overflow bugs)
const d = new Date();
d.setDate(d.getDate() + 30);
// After
const later = Temporal.Now.instant().add({ days: 30 });
```

### datetime-local string
```js
// Before (manual pad math)
const pad = n => String(n).padStart(2, '0');
`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
// After
Temporal.Now.plainDateTimeISO().toString().slice(0, 16)
```

### Time ago
```js
// Before
const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
// After
const seconds = Temporal.Instant.fromEpochMilliseconds(date.getTime()).since(Temporal.Now.instant()).seconds;
```

### Period arithmetic (stats cron)
```js
// Before (mutating, 0-indexed months)
const start = new Date();
start.setDate(1);
start.setMonth(start.getMonth() - 1);
start.setHours(0, 0, 0, 0);
// After
const start = Temporal.Now.plainDateISO().subtract({ months: 1 }).toPlainYearMonth();
```

---

## DB Interop

Drizzle stores timestamps as `Date` objects. Temporal interop at the boundary:

```ts
// Writing to DB
updatedAt: new Date(Temporal.Now.instant().epochMilliseconds)

// Reading from DB
const instant = Temporal.Instant.fromEpochMilliseconds(dbDate.getTime())
```

This is the one place `Date` and `Temporal` coexist — at the DB boundary. Wrap in
a shared utility (`lib/temporal-db.ts`) so the mixing is isolated.

---

## Cleanup

After all phases are complete:
- [ ] Remove all `new Date()` usage (grep to verify zero)
- [ ] Remove all `Date.now()` usage (grep to verify zero)
- [ ] Remove `datetime-local-utc.ts` if fully replaced
- [ ] Add ESLint rule: `no-restricted-syntax` banning `new Date(` and `Date.now()`
- [ ] Consider conditional polyfill loading (only load for browsers without native Temporal)

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Polyfill bundle size (~20 kB) | Tree-shake via subpath imports; load conditionally |
| Drizzle expects `Date` objects | Boundary utilities in `lib/temporal-db.ts` |
| `toLocaleString()` output differs between Temporal and Date | Test in CI — snapshot key UI strings |
| Safari without native Temporal | Polyfill covers it; test in Safari CI |
| Astro SSR vs client hydration mismatch | Use same Temporal types both sides; avoid timezone-dependent rendering in SSR |

---

## Not In Scope

- Subgraph `endTime` conversion (separate fix — the subgraph should store absolute timestamps)
- `Intl.DateTimeFormat` usage that doesn't touch `Date` objects
- `setTimeout`/`setInterval` (all simple delay-based, no date math)
