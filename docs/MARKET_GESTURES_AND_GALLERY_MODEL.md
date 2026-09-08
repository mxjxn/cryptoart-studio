# Market Gestures and Gallery Model

**Status:** Product direction  
**Updated:** 2026-09-08

## Premise

Cryptoart should not become a generic auctionhouse with social decoration.
`such.market` is the expressive market layer: a place where artists, collectors,
and curators create meaningful conditions for how a work circulates.

`such.gallery` establishes context, sequence, and taste around work. `such.market`
gives that work a way to move. `cryptoart.social` is where the resulting gestures
become legible to a wider public.

The terms describe product responsibilities before they require separate domains
or deployments. The initial public home remains cryptoart.social.

## Shared model

The stable objects are:

- **Artwork:** `(chainId, contractAddress, tokenId)` plus canonical metadata.
- **Person:** wallet authority, with optional Farcaster and display identities.
- **Gallery:** a curated sequence of artwork placements and editorial context.
- **Gesture:** a proposed or executed relationship among people, artworks, funds,
  conditions, and time.

Examples of gestures are `LIST`, `AUCTION`, `BID`, `BUY`, `OFFER`, `TRADE`,
`CURATE`, `BACK`, `MINT`, `GIFT`, and `POOL`.

The feed should prioritize these actions and their attached commentary. A text
post may exist, but it is not the core product object. The product question for a
new feature is: **does it let someone make a culturally meaningful gesture that
they cannot make elsewhere?**

## Responsibilities

| System             | Primary responsibility                              | Produces                                                        |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| `such.gallery`     | Context, selection, sequence, curatorial authorship | galleries, placements, publication records                      |
| `such.market`      | Expressive terms of circulation                     | listings, auctions, proposals, trades, pools                    |
| `cryptoart.social` | Discovery and public conversation                   | gesture feed, artwork pages, exhibition pages, identity context |
| `cryptoart.studio` | Artist operations                                   | collections, mints, media, advanced management                  |

Each system reads a shared artwork identity. No system owns the truth of a wallet
or token transfer; chain state does. Each system emits durable references that
can be shown by the others.

## First market gesture: a collector trade proposal

The first `such.market` primitive beyond normal auction parity should be a narrow,
legible trade proposal:

```text
YOU GIVE                         YOU WANT

one or more owned works          one specific artwork
optional ETH/WETH top-up
expiry
all-or-nothing acceptance
```

The first version deliberately excludes arbitrary collection criteria, partial
fills, bundles from both sides, offers that depend on other offers, and automated
matching. Those are later order-model capabilities, not launch requirements.

Every proposal has a public, immutable presentation record that includes the
offered artwork identities, desired artwork identity, expiry, current validity,
proposer, optional note, and the signed-order reference. It shows provenance and
context without turning transaction mechanics into an opaque price row.

## Gallery and market in tandem

The first integration is intentionally small:

1. A curator creates or updates a gallery in such.gallery.
2. The gallery publishes a versioned record of placements and editorial copy.
3. Social renders the native 2D exhibition and links each placement to its
   canonical artwork page.
4. An active listing, auction, bid, or trade proposal can be attached to that
   artwork as a gesture, never as a replacement for the exhibition itself.
5. A scoped curator can spotlight an active gesture and write a short rationale.
6. Social emits gallery placement and curator-backed gesture events into the feed.

This makes curation an active form of cultural context without giving a curator
custody over the work or unilateral control over the owner’s market action.

## Data and durability boundaries

- Galleries publish versioned manifests with placement order, artwork identities,
  copy, curator identity, and publication status.
- Social caches and indexes manifests but can re-import them on a clean deployment.
- Market gestures retain onchain transaction or signed-order references.
- Social derives display cards and feed ranking from gestures; those caches can be
  rebuilt.
- Curator endorsements are separate signed or audited records. They do not alter
  ownership, order validity, or settlement.

## Delivery sequence

1. Finish auction/listing parity and canonical artwork pages in Social.
2. Define and implement the such.gallery read manifest with one published gallery.
3. Add curator roles, scopes, and exhibition publication audit records.
4. Render gallery placements and attached active auction/listing gestures on
   artwork pages and the feed.
5. Implement the narrow collector trade proposal as a self-contained vertical
   slice.
6. Add curator-backed gesture cards and profile context.
7. Evaluate more complex Seaport orders, criteria-based exchanges, blind mints,
   LSSVM curves, and other market choreography only after the first proposal flow
   is reliable and socially legible.

## Deferred ideas

The following are desirable directions, but should remain deliberately deferred
until the shared model is proven:

- NFT-for-NFT criteria orders and arbitrary bundles.
- Curator fee splits and sale attribution.
- Blind exchanges, collector choice, circles, and other multi-party mechanisms.
- Programmable edition curves and eligibility conditions.
- Automated matching or recommendation based on portfolio similarity.

They all fit the market-gesture model. Deferring them protects the clarity of the
first release while leaving a coherent path for the product to become more
expressive.
