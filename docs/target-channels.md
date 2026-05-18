# Target Channels & Tastemakers

> **Status**: Active research document — updated as ecosystem evolves
> **Date**: 2026-05-17
> **Source**: Neynar SQL queries against Farcaster protocol data
> **Referenced by**: [channel-feed-spec.md](./channel-feed-spec.md), [app-evolution-roadmap.md](./app-evolution-roadmap.md)

---

## Methodology

Channels and tastemakers identified through analysis of:

1. **/cryptoart top 100 contributors** (last 365 days, ranked by cast count)
2. **/gen-art top 100 contributors** (last 365 days, ranked by cast count)
3. **Cross-channel overlap** — where do these contributors also cast?
4. **Casts per contributor density** — engagement quality metric (higher = tighter community)
5. **Tastemaker gravity** — which accounts are most followed by the gen-art top 100?

---

## Target Channels (~22)

### Tier 1: Home + Primary Gen-Art

These are the channels the feed starts with. `/cryptoart` is ours. `/gen-art` and `/gifart` are the densest gen-art communities on Farcaster.

| Channel | Followers | Overlap w/ cryptoart | Casts/Contributor | Notes |
|---------|-----------|---------------------|-------------------|-------|
| `/cryptoart` | 54,154 | — (home) | — | We lead this channel (fid 4905) |
| `/gen-art` | 14,747 | 14 | **62.0** | Highest density of any channel. Real artists and creative coders. Uses `chain://` URL. |
| `/gifart` | 10,423 | 29 | 33.0 | Animated art, motion graphics. Significant overlap with cryptoart. |

### Tier 2: Cryptoart Sister Channels

Established art communities with significant overlap with /cryptoart. These are the natural amplification network — people here already buy and sell art on Farcaster.

| Channel | Followers | Overlap w/ cryptoart | Casts/Contributor | Notes |
|---------|-----------|---------------------|-------------------|-------|
| `/art` | 92,424 | 64 | 53.9 | Biggest art channel. Broad but high engagement. |
| `/objkt` | 4,669 | 61 | 36.7 | Tezos marketplace community. Established collector base. |
| `/tezos` | 6,295 | 51 | 28.1 | Tezos ecosystem. Overlaps heavily with objkt. |
| `/zora` | 172,334 | 56 | 41.4 | Largest NFT marketplace channel. On-chain art focus. |
| `/rodeo-club` | 13,123 | 49 | 34.7 | Rodeo marketplace. Art trading culture. |
| `/pkok` | 9,882 | 49 | 38.2 | NFT marketplace-adjacent. |
| `/superrare` | 96,866 | 27 | **47.3** | High-end digital art. Core users very active. |
| `/degen-art` | 11,657 | 27 | 32.3 | Speculative art trading. |
| `/ai-art` | 24,875 | 31 | 31.2 | AI-assisted art. Growing fast. |

### Tier 3: Gen-Art Ecosystem

Where gen-art top 100 contributors also cast. Tight, high-quality communities centered on creative coding.

| Channel | Followers | Overlap w/ gen-art | Casts/Contributor | Notes |
|---------|-----------|--------------------|-------------------|-------|
| `/fxhash` | — | 38 | — | Generative art marketplace on Tezos. Direct pipeline to gen-art collectors. |
| `/mono` | 527 | 34 | 18.0 | Tiny but dense. Monochrome/minimal art. |
| `/geometric` | — | 25 | — | Geometric art, pattern-based work. |
| `/visual-poetry` | — | 17 | — | Text-based visual art. |
| `/typography` | — | 21 | — | Type design, lettering, calligraphy. |
| `/minimalism` | — | 20 | — | Minimalist aesthetics. |

### Tier 4: High-Engagement Niche

Small communities with very high casts-per-contributor. These are the tightest art communities on Farcaster — people here are deeply engaged.

| Channel | Followers | Casts/Contributor | Notes |
|---------|-----------|-------------------|-------|
| `/emerge` | 1,233 | 27.0 | Emerging artists. 30 overlap with cryptoart. |
| `/betr` | 1,683 | **41.1** | High-engagement art community. |
| `/veg` | 9,858 | **50.2** | Art + culture. Very active core. |

---

## Channel URL Formats

Farcaster channels use different URL schemes. The feed client must handle both:

| Channel | URL Format | Example |
|---------|-----------|---------|
| Most channels | `warpcast.com` | `https://warpcast.com/~/channel/gifart` |
| `/gen-art` | `chain://` | `chain://eip155:8453/erc721:0x8C219c2a68881f97e53d4F4363c6D0d0aAa3a623/1` |

The `chain://` scheme resolves to an on-chain NFT that governs the channel. This affects both API queries (channel_id value differs) and any client-side channel resolution logic.

---

## Bridge Accounts

53 accounts appear in both the /cryptoart and /gen-art top 100s. These are the cross-pollinators — they cast in both communities and bridge the gap.

Top bridges (gen-art casts → cryptoart casts):

| Handle | Gen-Art Casts | Cryptoart Casts | Notes |
|--------|--------------|----------------|-------|
| @psr | 311 | 187 | Most active bridge |
| @chrisfollows | 207 | 132 | Strong in both |
| @v4w-enko | 252 | 36 | Primarily gen-art |

These users are natural ambassadors. When cryptoart.social launches feed features, their content should appear in both channel contexts.

---

## Target Tastemakers

### Who the Gen-Art Top 100 Follows

These accounts are the gravity centers of the gen-art community — most-followed by the gen-art top 100:

| Handle | Followers (gen-art top 100) | Already follows @mxjxn? |
|--------|---------------------------|------------------------|
| @kaloh | 48 | ✅ Yes |
| @dwr | 47 | ❌ No |
| @downshift.eth | 48 | ✅ Yes |
| @jesse.base.eth | 41 | ✅ Yes |
| @gorillasun | 38 | ✅ Yes |
| @zancan | 44 | ❌ No |
| @lennyjpg | 40 | ❌ No |
| @xcopy.eth | 38 | ✅ Yes |
| @artblocks | 38 | ❌ No |
| @brightmoments | 38 | ❌ No |

**16 of 30 identified tastemakers already follow @mxjxn.** The remaining 14 are high-value targets.

### 14 Targets Not Yet Following @mxjxn

| Handle | Active (last 14d)? | Last Cast | Casts (14d) | Notes |
|--------|-------------------|-----------|-------------|-------|
| @nikolaii.eth | ✅ Active | 2026-05-17 | 234 | Extremely active. Warm lead. |
| @dwr | ✅ Active | 2026-05-15 | 8 | Dan Romero. Protocol-level connection. |
| @whitekross | ✅ Active | 2026-05-12 | 2 | Occasionally active. |
| @zancan | ⚪ Silent | — | 0 | Posts elsewhere. |
| @artblocks | ⚪ Silent | — | 0 | Brand account. Posts on X mostly. |
| @brightmoments | ⚪ Silent | — | 0 | IRL events. |
| @lennyjpg | ⚪ Silent | — | 0 | — |
| @markwebster | ⚪ Silent | — | 0 | — |
| @vicdoval | ⚪ Silent | — | 0 | — |
| @olgaf | ⚪ Silent | — | 0 | — |
| @nftbiker | ⚪ Silent | — | 0 | — |
| @wtbs | ⚪ Silent | — | 0 | — |
| @annawolf | ⚪ Silent | — | 0 | — |
| @fluffheadchaser | ⚪ Silent | — | 0 | — |

**@nikolaii.eth is the warmest lead** — 234 casts in the last 2 weeks, posting today. Getting them engaged with cryptoart.social would be high-signal.

---

## Ecosystem Clusters

The gen-art and cryptoart communities form distinct but overlapping clusters:

### Gen-Art Cluster
`/gen-art` → `/fxhash` → `/mono` → `/geometric` → `/visual-poetry` → `/typography` → `/minimalism`

These are creative coders. They share process, tools, and outputs. The density is real — 62 casts/person in /gen-art vs ~33 average elsewhere.

### Cryptoart Cluster
`/cryptoart` → `/objkt` → `/tezos` → `/rodeo-club` → `/pkok` → `/zora`

These are collectors and traders. They discuss sales, market dynamics, and individual pieces. More commercial than the gen-art cluster.

### Overlap Zone
`/art` → `/gifart` → `/superrare` → `/itookaphoto`

These channels serve both communities. Content here tends to be more visual (sharing work) and less discussion-oriented.

---

## /cryptoart Channel Profile

For reference, the channel we lead:

- **Followers**: 54,154
- **Lead**: @mxjxn (fid 4905)
- **Top contributor**: @carlos28355 (857 casts, 292 active days)
- **@mxjxn rank**: #5 (503 casts, 226 active days)
- **Total casts (last year)**: ~6,400 from top 100 alone

### Top 10 /cryptoart Contributors

| Handle | Casts | Active Days |
|--------|-------|-------------|
| @carlos28355 | 857 | 292 |
| @push- | 270 | 260 |
| @cryptoladygabi | 267 | 177 |
| @kristinathiele | 241 | 136 |
| @mxjxn | 503 | 226 |
| @vectorz3r0 | 227 | 155 |
| @chrisfollows | 207 | 158 |
| @antonis-tsagari | 202 | 144 |
| @greenginger | 195 | 169 |
| @psr | 187 | 137 |

---

## Data Sources

All data queried from Neynar SQL (Redash API at `data.hubs.neynar.com`):

- `/cryptoart` top 100: FIDs saved in session data
- `/gen-art` top 100: FIDs saved in session data
- Cross-channel overlap: `channel_follows` + `casts` tables
- Tastemaker follows: `links` table (who does gen-art top 100 follow)
- Activity recency: `casts` table filtered by 14-day window
- Bridge accounts: intersection of cryptoart + gen-art top 100 FIDs

See `/root/.hermes/knowledge/cryptoart-channel-analysis.md` for the full /cryptoart ecosystem breakdown and `/root/.hermes/knowledge/neynar-sql-schema.md` for query reference.
