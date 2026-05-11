# Research: Indexing Base + Ethereum with The Graph (Subgraphs vs Substreams)

**Goal:** Decide how to expose auctionhouse listings from **Base (8453)** and **Ethereum mainnet (1)** to the MVP, given uncertainty about whether **one subgraph deployment** can watch **two chains**.

**Status:** Research / decision aid (not an implementation spec).

---

## 1. Direct answer: one subgraph, two chains?

**Official subgraph manifest behavior (The Graph docs):**

> A single Subgraph can index data from **multiple smart contracts** (but **not multiple networks**).

Source: [Subgraph manifest](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/) (overview bullets at top of page).

**Implication:** A **single deployed subgraph version** is tied to **one chain** for its `dataSources`. You do **not** get one Studio deployment / one query URL that simultaneously indexes Base and Ethereum as two independent L1s in the way people often imagine “one subgraph, two chains.”

**What *is* supported:** The **same subgraph codebase** (schema + mappings) deployed **twice** (once per network), with per-network contract addresses and `network:` field — see [Deploying a Subgraph to Multiple Networks](https://thegraph.com/docs/en/subgraphs/developing/deploying/multiple-networks/) (`networks.json`, `graph build --network <name>`, `graph deploy --network <name>`).

So the product choice becomes:

| Approach | Query surface | Notes |
|----------|-----------------|--------|
| **A. Two subgraph deployments** (recommended baseline) | Two GraphQL endpoints (or one app-layer merge) | Same repo; `networks.json` for Base vs `mainnet`; add `chainId` to entity IDs or a `chainId` field so merged feeds do not collide on `listingId`. |
| **B. App merges two endpoints** | MVP calls both, merges/sorts | No change to Graph protocol limits; requires schema support for disambiguation (`chainId`). |
| **C. Substreams → sink** | Depends on sink | See §4; does not remove the “logical” split unless the sink product explicitly unifies chains. |

---

## 2. How our repo is structured today (`packages/auctionhouse-subgraph`)

### Manifest (`subgraph.yaml`)

- **`specVersion: 0.0.5`**
- **Two `dataSources`**, both:
  - `kind: ethereum`
  - **`network: base`**
  - **Same proxy address** (`0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`) — marketplace
- **MarketplaceCore** data source: `MarketplaceLib` ABI + event handlers for listing lifecycle (library events emitted **from** the proxy).
- **SettlementLib** data source: same address again, `SettlementLib` ABI, `Escrow` events.

This matches the intended pattern: **multiple ABIs / event signatures against one contract address**, split for clarity.

### Learning: events “not in the main ABI” / library events

Solidity **libraries** used by the marketplace can emit events that appear in logs **with the marketplace contract as `address`**, but the **event signature** comes from the library’s ABI.

The subgraph indexes those by:

1. Declaring the correct **`event:`** signature under `eventHandlers`, and  
2. Using the **library ABI** on the `source` where appropriate (see `MarketplaceLib` on the first data source).

Handlers import generated types from `generated/MarketplaceCore/MarketplaceLib` etc. (`src/auctionhouse.ts`).

**Takeaway for Ethereum:** The same pattern applies on mainnet as long as the **proxy address** and **event signatures** match the deployed bytecode (same layout / same libraries).

### Schema (`schema.graphql`)

- **`Listing.id`** is currently **`listingId` as string** (see mapping: `let id = listingId.toString()`).
- **`marketplace`** is `Bytes!` on the entity — good for per-deployment address, but **does not replace `chainId`** when two chains can reuse the same numeric `listingId`.

**Risk for multi-chain:** Without a **`chainId`** (or composite `id = chainId + "-" + listingId`), any **merged** GraphQL or client cache will confuse listings across chains.

### Mapping hardcoding (`src/auctionhouse.ts`)

`getOrCreateListing` sets:

```typescript
listing.marketplace = Address.fromString("0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9");
```

That is **Base-specific**. For a `mainnet` deployment, this must become the **Ethereum proxy** address (e.g. `0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef`) or be read from **manifest context** / **constants per network** so `networks.json` does not drift from mappings.

---

## 3. Official workflow: same code, two networks

[Deploying a Subgraph to Multiple Networks](https://thegraph.com/docs/en/subgraphs/developing/deploying/multiple-networks/) describes:

- A **`networks.json`** file mapping logical data source names → `address` / `startBlock` per network name (`mainnet`, `base`, `sepolia`, … per The Graph’s network naming).
- **`graph build --network <name>`** / **`graph deploy --network <name>`** (CLI versions noted in docs) to substitute into `subgraph.yaml` before build/deploy.

[Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/) covers Studio → deploy → query URL; each **deployment** is still **one** indexed network in practice.

**Project action (later):** Add `networks.json` entries for `base` and `mainnet`, parameterize `subgraph.yaml` `network:` + addresses + `startBlock`, and either:

- Deploy **two** subgraphs (e.g. `cryptoart-auctionhouse-base`, `cryptoart-auctionhouse-mainnet`), or  
- One slug with **two published versions / two endpoints** (whatever Studio / your hosting model uses) — still **two query URLs** from the app’s perspective unless you add a **gateway merge**.

---

## 4. Substreams vs subgraphs (relevance to “one query for two chains”)

[Introduction to Substreams](https://thegraph.com/docs/en/substreams/introduction/) highlights:

- Parallel indexing / performance.
- **“Multi-Chain Support”** at the **Substreams** platform level (indexing beyond a single EVM chain in the broader sense).
- **Multi-sink** output (e.g. subgraph, Postgres, etc.).

**Caution:** Substreams being “multi-chain” does **not** automatically mean your **dapp gets one subgraph GraphQL endpoint** that transparently unions Base + Ethereum listings. Typical patterns are still:

- **Per-chain** Substreams (or per-chain modules), then  
- **Per-chain sinks** or **your own merge service**.

Using Substreams as a **preprocessing** layer for a subgraph can still end with **one subgraph deployment = one chain** unless The Graph adds a first-class “multi-chain single deployment” product (not what the manifest doc describes today).

**When Substreams are worth it here:** High volume, traces, or shared Rust transforms across deployments — **not** the minimal fix for “show Base + ETH listings,” which is **two subgraphs + merge** or **schema `chainId` + two URLs**.

---

## 5. Recommendations (for planning)

1. **Accept two deployments** under The Graph’s current subgraph model; treat “one subgraph” as **one codebase**, not one HTTP endpoint for two L1s.
2. **Add `chainId: Int!` (or `network: String!`)** to `Listing` (and any entity keyed by listing) and use **composite `id`**s (`${chainId}-${listingId}`) **or** keep numeric id but **never merge** without `chainId` in the same store.
3. **Parameterize** hardcoded marketplace bytes in `getOrCreateListing` (and any similar spots) via **network-specific config** generated at build time.
4. **MVP env:** Move from single `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` to **two URLs** or a **small BFF** that runs the same GraphQL fragments against both endpoints and merges (documented in app repo when implemented).
5. **Revisit Substreams** if indexing cost/latency or cross-chain analytics becomes painful; not required to unlock dual-chain listings.

---

## 6. Reference links

| Topic | URL |
|--------|-----|
| Subgraph manifest (multi-contract, not multi-network) | https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/ |
| Deploy same subgraph to multiple networks | https://thegraph.com/docs/en/subgraphs/developing/deploying/multiple-networks/ |
| Quick start (Studio / deploy / query) | https://thegraph.com/docs/en/subgraphs/quick-start/ |
| Substreams introduction | https://thegraph.com/docs/en/substreams/introduction/ |

---

## 7. Appendix: Ethereum mainnet deployment (for `networks.json`)

Recorded at research time (verify in deployments / Etherscan before use):

- **Marketplace proxy (chain 1):** `0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef`
- **Start block:** Set from deployment tx block (dry-run / broadcast logs), analogous to Base `startBlock: 38886000` pattern in `subgraph.yaml`.

Base proxy in manifest today: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`.
