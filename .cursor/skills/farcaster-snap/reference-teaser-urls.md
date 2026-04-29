# CryptoArt snap teaser URLs

Production host: **`https://snap.cryptoart.social`** (Vercel + custom domain).

## Gallery

```
https://snap.cryptoart.social/?kind=gallery&identifier=<usernameOr0xAddress>&slug=<slug>
```

Example cast line: “Peep this show — ” + URL above with your gallery’s `identifier` (Farcaster username or curator `0x…`) and `slug`.

## Listing

```
https://snap.cryptoart.social/?kind=listing&listingId=<listingId>
```

`listingId` is the on-chain listing id used in `/listing/[listingId]` and `/api/auctions/[listingId]`.

## Help / empty

Opening `https://snap.cryptoart.social/` without `kind` returns a minimal help snap with parameter hints.

## Data sources

- Gallery: MVP `GET /api/curation/user/.../gallery/...`
- Listing: MVP `GET /api/auctions/[listingId]` (`auction` object in JSON)

No auth; unpublished galleries return an error snap.
