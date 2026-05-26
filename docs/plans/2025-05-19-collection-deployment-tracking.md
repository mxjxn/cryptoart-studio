# Collection Deployment & Custom Indexer

**Goal:** Artists deploy NFT collections through our factory contract. A standalone indexer watches the factory + all deployed collections, writes everything to Postgres. Frontend queries API endpoints backed by that DB. No subgraph, no third-party watchers.

**Chains:** Base (primary), Ethereum mainnet (later). Sepolia for testing.

---

## Resolved Decisions

| Decision | Rationale |
|----------|-----------|
| **Fork Manifold Creator Core, don't use Manifold's contracts directly** | Manifold runs watchers on proxied deployments — their automated systems tracked our auctions. We want full independence. Lift their extension/royalty patterns into our own contracts. |
| **No subgraph** | Subgraphs require static data sources or redeployment per new collection. Factory-deployed collections would need constant subgraph updates. Custom indexer into Postgres is simpler and fully under our control. |
| **Standalone indexer package** (`packages/collection-indexer/`) | Indexer runs a continuous polling loop — doesn't work in serverless (Vercel). Separate process avoids coupling infrastructure to the web app. Clean boundary: Next.js queries the DB the indexer populates. |
| **Artist signs via wallet** | Backend constructs tx params, frontend sends via wallet connection. Backend watches receipt. No custodial signing. |
| **Factory emits events** | `CollectionCreated(address, address, string, string)` — indexer auto-discovers new collections. |
| **Keep on-chain Enumerable** | Gallery rendering needs it. Worth the ~25k gas per mint. |
| **Basic minting first (owner-only)** | Extension machinery included in contracts (registerExtension/unregisterExtension) for future use (lazy mint, reveal, burn-to-mint). No extension contracts built yet. |
| **Frontend polls API** | No WebSockets. Sensible polling interval on status endpoints. |
| **Network order: Sepolia → Base → mainnet** | Test first on Sepolia, deploy to Base for production, mainnet later. |
| **Immutable factory** | Simpler. If we need a new factory version, deploy a new one and update backend config. |
| **Single royalty receiver + BPS** | Not multi-receiver arrays. Simpler, EIP-2981 standard. Can extend later. |

---

## Smart Contracts

### Source: Fork Manifold Creator Core

Copy `packages/creator-core-contracts/` → `packages/collection-contracts/`, then strip heavily.

**Keep from Manifold:**

| Contract | What we keep |
|----------|-------------|
| `ERC721Core.sol` | Custom ERC721 (ownerOf, transfer, approve, mint, burn) — strip `uint96 tokenData` packing, simplify to standard owner mapping |
| `ERC721Base.sol` | Constructor wrapper (name, symbol) |
| `CreatorCore.sol` | Token counting, `tokenURIs`, base URI, URI prefix, royalties (EIP-2981), extension registration set |
| `ERC721CreatorCore.sol` | Extension index tracking (extension address ↔ uint16 index), `mintExtension` plumbing |
| Extension registration | `registerExtension(address, string baseURI)`, `unregisterExtension(address)`, extension set tracking |
| Mint functions | `mintBase`, `mintBaseBatch`, `mintExtension`, `mintExtensionBatch` |
| Burn | Standard owner/approved burn |
| tokenURI resolution | Per-token URI, base URI fallback, URI prefix support |
| Royalties | `getRoyalties`, `royaltyInfo` (EIP-2981), `setRoyalties`, per-token royalty overrides |

**Strip entirely:**

| Feature | What's removed |
|---------|---------------|
| Blacklist | `_blacklistedExtensions`, `requireNonBlacklist`, `blacklistExtension` |
| Approve-transfer hooks | `_approveTransferBase`, `_extensionApproveTransfers`, all `_approveTransfer` overloads |
| `baseURIIdentical` flag | The bool parameter + branching logic in `_tokenURI` |
| Mint permissions | `_extensionPermissions`, `_checkMintPermissions`, `setMintPermissions` |
| Burn callbacks | `_postBurn` calling `onBurn` on extensions |
| Manifold's custom Enumerable | Per-extension per-owner tracking — overkill |
| AdminControl | Replace with simple `Ownable` from OpenZeppelin |
| All ERC1155 | Entire parallel tree |
| All upgradeable variants | No proxies, no Initializable |
| All extension helper contracts | `extensions/` directory (9 files), `permissions/` directory (4 files) |

**Add new:**

| Addition | Detail |
|----------|--------|
| `Ownable` (OZ) | Replace Manifold's `AdminControl` |
| `ERC721Enumerable` (OZ) | Standard on-chain enumerable — `totalSupply`, `tokenByIndex`, `tokenOfOwnerByIndex` |
| `event Minted(address indexed to, uint256 indexed tokenId, string tokenURI)` | Custom mint event — gives indexer the URI at mint time |
| `event RoyaltyUpdated(address receiver, uint16 bps)` | Royalty change event |
| `event BaseURIUpdated(string baseURI)` | Base URI change event |
| Solidity 0.8.27 | Up from Manifold's 0.8.17 |

### 1. `SuchCollection` — ERC721 Collection Contract

Each artist gets their own instance. Forked + stripped Manifold Creator Core.

```
contract SuchCollection is ERC721Base, ERC721CreatorCore, Ownable, ReentrancyGuard {

    // ─── Events ───────────────────────────────────────
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event ExtensionRegistered(address indexed extension, string baseURI);
    event ExtensionUnregistered(address indexed extension);
    event BaseURIUpdated(string baseURI);
    event RoyaltyUpdated(address receiver, uint16 bps);

    // ─── Constructor ──────────────────────────────────
    constructor(string memory name, string memory symbol, address owner,
                address payable royaltyReceiver, uint16 royaltyBPS);

    // ─── Minting (owner or extension) ─────────────────
    function mint(address to, string calldata uri) external returns (uint256);
    function mintBatch(address to, string[] calldata uris) external returns (uint256[] memory);

    // ─── Extension management (owner only) ────────────
    function registerExtension(address extension, string calldata baseURI) external onlyOwner;
    function unregisterExtension(address extension) external onlyOwner;
    function getExtensions() external view returns (address[] memory);

    // ─── Metadata ─────────────────────────────────────
    function tokenURI(uint256 tokenId) external view returns (string);
    function setBaseURI(string calldata baseURI) external onlyOwner;
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner;

    // ─── Royalty (EIP-2981) ───────────────────────────
    function setRoyalty(address payable receiver, uint16 bps) external onlyOwner;
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);

    // ─── Burn ─────────────────────────────────────────
    function burn(uint256 tokenId) external;

    // ─── View ─────────────────────────────────────────
    function supportsInterface(bytes4) external view returns (bool);
}
```

### 2. `SuchCollectionFactory` — Deploys Collections

New contract. Not from Manifold (they don't have a factory).

```
contract SuchCollectionFactory is Ownable {

    address[] public collections;
    mapping(address => address) public collectionOwner;       // collection => artist
    mapping(address => address[]) public artistCollections;   // artist => collections[]

    event CollectionCreated(
        address indexed collection,
        address indexed owner,
        string name,
        string symbol
    );

    function createCollection(
        string calldata name,
        string calldata symbol,
        address payable royaltyReceiver,
        uint16 royaltyBPS
    ) external returns (address);

    function getCollectionsByArtist(address artist) external view returns (address[] memory);
    function getAllCollections() external view returns (address[] memory);
    function collectionCount() external view returns (uint256);
}
```

- Uses `new SuchCollection(...)` — CREATE, not CREATE2. Add CREATE2 later if needed.
- `msg.sender` becomes the collection owner (artist's wallet).
- Factory owner is our platform.

---

## Database Schema

Add to `packages/db/src/schema.ts`:

### `collections` table

```typescript
export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: text('name').notNull(),
  symbol: text('symbol').notNull(),

  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),
  factoryAddress: text('factory_address').notNull(),
  deployTxHash: text('deploy_tx_hash').notNull(),
  deployBlockNumber: bigint('deploy_block_number', { mode: 'number' }),

  ownerAddress: text('owner_address').notNull(),

  royaltyReceiver: text('royalty_receiver'),
  royaltyBPS: integer('royalty_bps').default(0),

  description: text('description'),
  imageUrl: text('image_url'),
  bannerUrl: text('banner_url'),

  status: text('status').notNull().default('deploying'),
  totalSupply: integer('total_supply').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  contractChainIdx: index('collections_contract_chain_idx').on(table.contractAddress, table.chainId),
  ownerIdx: index('collections_owner_address_idx').on(table.ownerAddress),
  statusIdx: index('collections_status_idx').on(table.status),
  factoryIdx: index('collections_factory_address_idx').on(table.factoryAddress),
}));
```

### `collection_tokens` table

```typescript
export const collectionTokens = pgTable('collection_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),

  collectionId: uuid('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),

  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(),

  tokenURI: text('token_uri'),
  name: text('name'),
  description: text('description'),
  imageUrl: text('image_url'),
  animationUrl: text('animation_url'),
  attributes: jsonb('attributes'),

  ownerAddress: text('owner_address').notNull(),
  mintTxHash: text('mint_tx_hash').notNull(),
  mintBlockNumber: bigint('mint_block_number', { mode: 'number' }),
  mintedByExtension: text('minted_by_extension'),

  metadataStatus: text('metadata_status').notNull().default('pending'),
  metadataRetries: integer('metadata_retries').notNull().default(0),

  burnedAt: timestamp('burned_at'),

  mintedAt: timestamp('minted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  contractTokenIdx: uniqueIndex('collection_tokens_contract_token_idx')
    .on(table.contractAddress, table.chainId, table.tokenId),
  collectionIdx: index('collection_tokens_collection_id_idx').on(table.collectionId),
  ownerIdx: index('collection_tokens_owner_address_idx').on(table.ownerAddress),
  metadataStatusIdx: index('collection_tokens_metadata_status_idx').on(table.metadataStatus),
}));
```

### `collection_deployments` table

```typescript
export const collectionDeployments = pgTable('collection_deployments', {
  id: uuid('id').defaultRandom().primaryKey(),

  collectionId: uuid('collection_id'),

  chainId: integer('chain_id').notNull().default(8453),
  txHash: text('tx_hash').notNull(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address'),

  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  royaltyReceiver: text('royalty_receiver'),
  royaltyBPS: integer('royalty_bps').default(0),

  status: text('status').notNull().default('pending'),
  blockNumber: bigint('block_number', { mode: 'number' }),
  gasUsed: bigint('gas_used', { mode: 'number' }),
  effectiveGasPrice: bigint('effective_gas_price', { mode: 'number' }),

  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),

  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
  failedAt: timestamp('failed_at'),
}, (table) => ({
  txHashIdx: uniqueIndex('collection_deployments_tx_hash_idx').on(table.txHash, table.chainId),
  statusIdx: index('collection_deployments_status_idx').on(table.status),
  fromAddressIdx: index('collection_deployments_from_address_idx').on(table.fromAddress),
  submittedAtIdx: index('collection_deployments_submitted_at_idx').on(table.submittedAt),
}));
```

### `collection_extensions` table

```typescript
export const collectionExtensions = pgTable('collection_extensions', {
  id: uuid('id').defaultRandom().primaryKey(),

  collectionId: uuid('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),

  extensionAddress: text('extension_address').notNull(),
  baseURI: text('base_uri'),

  status: text('status').notNull().default('active'),

  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  registeredBlock: bigint('registered_block', { mode: 'number' }),
  unregisteredAt: timestamp('unregistered_at'),
  unregisteredBlock: bigint('unregistered_block', { mode: 'number' }),
}, (table) => ({
  collectionExtensionIdx: uniqueIndex('collection_extensions_collection_ext_idx')
    .on(table.contractAddress, table.chainId, table.extensionAddress),
  collectionIdx: index('collection_extensions_collection_id_idx').on(table.collectionId),
  statusIdx: index('collection_extensions_status_idx').on(table.status),
}));
```

### `collection_royalties` table

```typescript
export const collectionRoyalties = pgTable('collection_royalties', {
  id: uuid('id').defaultRandom().primaryKey(),

  collectionId: uuid('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),

  tokenId: bigint('token_id', { mode: 'bigint' }),

  receiverAddress: text('receiver_address').notNull(),
  bps: integer('bps').notNull(),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  defaultRoyaltyIdx: uniqueIndex('collection_royalties_default_idx')
    .on(table.contractAddress, table.chainId, table.tokenId),
  collectionIdx: index('collection_royalties_collection_id_idx').on(table.collectionId),
}));
```

### `transfer_events` table (append-only)

```typescript
export const transferEvents = pgTable('transfer_events', {
  id: uuid('id').defaultRandom().primaryKey(),

  collectionId: uuid('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(),

  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),

  eventType: text('event_type').notNull(),

  txHash: text('tx_hash').notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  logIndex: integer('log_index').notNull(),

  timestamp: timestamp('timestamp').notNull(),
}, (table) => ({
  txLogIdx: uniqueIndex('transfer_events_tx_log_idx').on(table.txHash, table.logIndex),
  collectionTokenIdx: index('transfer_events_collection_token_idx').on(table.collectionId, table.tokenId),
  fromIdx: index('transfer_events_from_address_idx').on(table.fromAddress),
  toIdx: index('transfer_events_to_address_idx').on(table.toAddress),
  blockIdx: index('transfer_events_block_number_idx').on(table.blockNumber),
}));
```

### `indexed_contracts` table (indexer state)

```typescript
export const indexedContracts = pgTable('indexed_contracts', {
  contractAddress: text('contract_address').notNull(),
  chainId: integer('chain_id').notNull().default(8453),

  lastIndexedBlock: bigint('last_indexed_block', { mode: 'number' }).notNull().default(0),
  status: text('status').notNull().default('active'),
  contractType: text('contract_type').notNull().default('such_collection'),

  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  errorMessage: text('error_message'),
}, (table) => ({
  pk: uniqueIndex('indexed_contracts_pk').on(table.contractAddress, table.chainId),
  statusIdx: index('indexed_contracts_status_idx').on(table.status),
}));
```

---

## Custom Indexer

**Package:** `packages/collection-indexer/` (standalone, long-running process)

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Collection Indexer (one instance per chain)     │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ Factory      │    │ Known Address Registry │  │
│  │ Watcher      │    │ (seeded at startup)    │  │
│  └──────┬───────┘    └───────────┬───────────┘  │
│         │                        │               │
│         ▼                        ▼               │
│  ┌──────────────────────────────────────────┐   │
│  │        Active Collection Set             │   │
│  │  (all addresses in indexed_contracts)    │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│         ┌───────────┼───────────┐                │
│         ▼           ▼           ▼                │
│  ┌────────────┐ ┌─────────┐ ┌──────────────┐   │
│  │ Event      │ │ Metadata│ │ State        │   │
│  │ Processors │ │ Resolver│ │ Manager      │   │
│  └────────────┘ └─────────┘ └──────────────┘   │
└─────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────┐
    │ Postgres │
    └─────────┘
```

### Event surface

All events come from our contracts only. No Manifold event decoding.

| Event | What it tells the indexer | DB action |
|-------|--------------------------|-----------|
| `Factory.CollectionCreated(collection, owner, name, symbol)` | New collection deployed | Insert `collections` row, insert `indexed_contracts` row |
| `Transfer(0x0, to, tokenId)` | Mint | Insert `collection_tokens` with `metadataStatus='pending'`, insert `transfer_events` as type `mint`, enqueue metadata fetch |
| `Transfer(from, to, tokenId)` (both non-zero) | Transfer | Update `collection_tokens.ownerAddress`, insert `transfer_events` as type `transfer` |
| `Transfer(from, 0x0, tokenId)` | Burn | Set `collection_tokens.burnedAt`, insert `transfer_events` as type `burn` |
| `Minted(to, tokenId, uri)` | Mint with URI | Same as Transfer mint + store tokenURI |
| `ExtensionRegistered(extension, baseURI)` | Extension added | Upsert `collection_extensions` as `active` |
| `ExtensionUnregistered(extension)` | Extension removed | Set `collection_extensions` status to `unregistered` |
| `RoyaltyUpdated(receiver, bps)` | Royalty change | Upsert `collection_royalties` |
| `BaseURIUpdated(baseURI)` | Base URI change | Update collection metadata config |

### Two loops per chain

**Loop 1 — Factory watcher** (every 30s):

```
load factory address for chain
logs = getLogs(factory, fromBlock=lastFactoryBlock, toBlock=current)
for each CollectionCreated event:
  insert into collections (name, symbol, owner, contractAddress, chainId, status='active')
  insert into indexed_contracts (contractAddress, chainId, lastIndexedBlock=deployBlock, status='active')
update lastFactoryBlock
```

**Loop 2 — Collection scanner** (every 5s):

```
load all active contracts from indexed_contracts WHERE chainId = X
addresses = all active contract addresses
logs = getLogs(address=addresses, fromBlock=min(lastIndexedBlock)+1, toBlock=current)
for each log:
  decode by topic → route to processor
  Transfer(from=0x0)     → insert collection_tokens + transfer_events, enqueue metadata
  Transfer(from≠0, to≠0) → update collection_tokens.ownerAddress, insert transfer_events
  Transfer(to=0x0)       → mark token burned, insert transfer_events
  Minted                 → update token URI
  ExtensionRegistered    → upsert collection_extensions
  ExtensionUnregistered  → mark collection_extensions inactive
  RoyaltyUpdated         → upsert collection_royalties
  BaseURIUpdated         → update collection metadata config
update indexed_contracts.lastIndexedBlock per contract
```

**Key optimization:** viem's `getLogs({ address: [addr1, addr2, ...] })` sends one RPC call for all active collections. No per-collection polling.

### Metadata resolution (async worker)

```
every 10s:
  tokens = SELECT * FROM collection_tokens WHERE metadataStatus='pending' AND metadataRetries < 3 LIMIT 10
  for each token:
    tokenURI = RPC.tokenURI(tokenId) or from Minted event
    metadata = fetch(tokenURI)  // resolve IPFS gateway or HTTP
    update collection_tokens SET name, description, imageUrl, animationUrl, attributes, metadataStatus='resolved'
    on failure: SET metadataStatus='failed', metadataRetries++
```

### File structure

```
packages/collection-indexer/
  src/
    index.ts              # Entry point — start all chain loops, graceful shutdown
    config.ts             # Chain configs (RPC, factory addresses, start blocks)
    chains/
      base.ts             # Base chain config
      ethereum.ts         # Mainnet config
      sepolia.ts          # Testnet config
    loops/
      factory-watcher.ts  # Watch factory for CollectionCreated
      collection-scanner.ts # Batch scan all active collections
    processors/
      transfer.ts         # Process Transfer events (mint, transfer, burn)
      extension.ts        # Process ExtensionRegistered/Unregistered
      royalty.ts          # Process RoyaltyUpdated
      base-uri.ts         # Process BaseURIUpdated
    metadata/
      resolver.ts         # Async metadata fetch + cache
      ipfs.ts             # IPFS gateway resolution
    state.ts              # Indexed contract state management
    client.ts             # viem public client creation
    abis/
      SuchCollection.json
      SuchCollectionFactory.json
  package.json
  tsconfig.json
```

### Multi-chain

One process, concurrent loops per chain. Same DB, everything keyed by `chainId`.

```typescript
const chains = [
  { chainId: 8453, rpcUrl: process.env.BASE_RPC_URL, factoryAddress: '0x...', startBlock: 12345 },
  { chainId: 11155111, rpcUrl: process.env.SEPOLIA_RPC_URL, factoryAddress: '0x...', startBlock: 12345 },
];
```

---

## API Endpoints

All in the existing Next.js app (`apps/mvp/src/app/api/`).

### Deployment flow

```
Frontend                    Backend                          Chain
   │                          │                               │
   │  POST /collections/deploy│                               │
   │─────────────────────────>│                               │
   │                          │ encode factory call            │
   │  { txRequest, deployId } │                               │
   │<─────────────────────────│                               │
   │                          │                               │
   │  wallet.signAndSend()    │                               │
   │─────────────────────────────────────────────────────────>│
   │                          │                               │
   │  POST /deploy/:id/submit │                               │
   │─────────────────────────>│                               │
   │                          │ create pending deployment row  │
   │  { status: pending }     │                               │
   │<─────────────────────────│                               │
   │                          │                               │
   │                          │  <CollectionCreated event>    │
   │                          │<──────────────────────────────│
   │                          │ indexer inserts collection row │
   │                          │                               │
   │  GET /deploy/:id/status  │                               │
   │─────────────────────────>│                               │
   │  { status: confirmed,    │                               │
   │    contractAddress, ... }│                               │
   │<─────────────────────────│                               │
```

### Endpoints

**`POST /api/collections/deploy`** — Initiate deployment
```
Request: { name, symbol, chainId?, royaltyReceiver?, royaltyBPS? }
Response: { txRequest: { to, data, from, chainId, gasLimit }, deploymentId }
```

**`POST /api/collections/deploy/:deploymentId/submit`** — Submit signed tx
```
Request: { txHash }
Response: { deploymentId, status: "pending" }
```

**`GET /api/collections/deploy/:deploymentId/status`** — Poll deployment status
```
Response: { deploymentId, status, collectionId?, contractAddress?, txHash?, blockNumber?, gasUsed?, confirmedAt? }
```

**`GET /api/collections`** — List collections
```
Query: ?owner=0x...&chainId=8453&status=active&page=1&limit=20
Response: { collections: [...], total, page, limit }
```

**`GET /api/collections/:collectionId`** — Collection detail
```
Response: { id, name, symbol, contractAddress, chainId, ownerAddress, royaltyReceiver, royaltyBPS,
            description, imageUrl, bannerUrl, status, totalSupply, extensions, createdAt, confirmedAt }
```

**`GET /api/collections/:collectionId/tokens`** — Tokens in collection
```
Query: ?page=1&limit=50&owner=0x...
Response: { tokens: [...], total, page, limit }
```

**`GET /api/collections/:collectionId/tokens/:tokenId`** — Single token detail
```
Response: { id, tokenId, tokenURI, name, description, imageUrl, animationUrl, attributes,
            ownerAddress, mintedByExtension, mintedAt, transferHistory: [...] }
```

**`GET /api/collections/:collectionId/transfers`** — Transfer history
```
Query: ?page=1&limit=50&tokenId=5
Response: { transfers: [...], total, page, limit }
```

**`PATCH /api/collections/:collectionId`** — Update off-chain metadata
```
Request: { description?, imageUrl?, bannerUrl? }
Response: { success: true }
```

---

## File Structure

```
packages/
  collection-contracts/              # NEW — Foundry project (forked from creator-core-contracts)
    foundry.toml
    remappings.txt
    src/
      SuchCollection.sol
      SuchCollectionFactory.sol
      core/
        CreatorCore.sol              # Stripped from Manifold
        ERC721CreatorCore.sol        # Stripped from Manifold
      token/
        ERC721/
          ERC721Core.sol             # From Manifold
          ERC721Base.sol             # From Manifold
          ERC721Enumerable.sol       # OpenZeppelin standard
      interfaces/
        ISuchCollection.sol
        ISuchCollectionFactory.sol
    test/
      SuchCollection.t.sol
      SuchCollectionFactory.t.sol
    script/
      DeployFactory.s.sol

  collection-indexer/                # NEW — Standalone indexer
    src/
      index.ts
      config.ts
      client.ts
      state.ts
      chains/
      loops/
      processors/
      metadata/
      abis/
    package.json
    tsconfig.json

  db/
    src/
      schema.ts                      # ADD: 7 new tables
    migrations/
      XXXX_add_collection_tables.sql
```

---

## Task Breakdown

### Phase 1: Smart Contracts (Foundry)

| # | Task | Verifiable when |
|---|------|----------------|
| 1.1 | Scaffold `packages/collection-contracts/` — copy foundry.toml, remappings, lib/ deps from creator-core-contracts, upgrade Solidity to 0.8.27, create dummy contract | `forge build` passes |
| 1.2 | Port `ERC721Core.sol` + `ERC721Base.sol` — strip `uint96 tokenData` packing, simplify to standard owner mapping | `forge build` compiles |
| 1.3 | Port stripped `CreatorCore.sol` — tokenURIs, baseURI, royalties, extension set. Remove blacklist, approve-transfer, baseURIIdentical, mint permissions, burn callbacks | `forge build` compiles |
| 1.4 | Port stripped `ERC721CreatorCore.sol` — extension index tracking, mintExtension plumbing. Remove approve-transfer hooks, mint permissions | `forge build` compiles |
| 1.5 | Write `SuchCollection.sol` — wire everything together, Ownable instead of AdminControl, add Minted/RoyaltyUpdated/BaseURIUpdated events, add OZ ERC721Enumerable | `forge build` compiles |
| 1.6 | Write `SuchCollectionFactory.sol` — deploy collections, track mappings, emit CollectionCreated | `forge build` compiles |
| 1.7 | Write interfaces — `ISuchCollection.sol`, `ISuchCollectionFactory.sol` | `forge build` compiles |
| 1.8 | Unit tests for SuchCollection — mint, mintBatch, burn, tokenURI, royalties (set/query), extension register/unregister, ownership, Enumerable | `forge test` passes |
| 1.9 | Unit tests for SuchCollectionFactory — deploy collection, track mappings, event emission, multi-artist | `forge test` passes |
| 1.10 | Deploy script `DeployFactory.s.sol` — Sepolia target, reads factory owner from env | `forge script --dry-run` succeeds |

### Phase 2: Database

| # | Task | Verifiable when |
|---|------|----------------|
| 2.1 | Add 7 tables to `packages/db/src/schema.ts`: collections, collection_tokens, collection_deployments, collection_extensions, collection_royalties, transfer_events, indexed_contracts | TypeScript compiles |
| 2.2 | Generate Drizzle migration | Migration file created |
| 2.3 | Apply migration to dev DB | `drizzle-kit push` succeeds, tables visible in psql |

### Phase 3: Standalone Indexer

| # | Task | Verifiable when |
|---|------|----------------|
| 3.1 | Scaffold `packages/collection-indexer/` — package.json, tsconfig, deps (viem, @cryptoart/db) | `tsc` compiles |
| 3.2 | Implement `config.ts` + `client.ts` — chain configs from env, viem public client per chain | Unit test: client connects to RPC |
| 3.3 | Implement `state.ts` — load/save `indexed_contracts`, get active set, update lastIndexedBlock | Unit test: round-trips state to DB |
| 3.4 | Implement `factory-watcher.ts` — poll factory for CollectionCreated events, insert into collections + indexed_contracts | Unit test with mocked logs |
| 3.5 | Implement processors: `transfer.ts` (mint/transfer/burn), `extension.ts`, `royalty.ts`, `base-uri.ts` — pure functions: decoded event → DB operations | Unit tests for each processor |
| 3.6 | Implement `collection-scanner.ts` — batch getLogs across all active collections, route to processors, update indexed_contracts | Integration test with mocked RPC |
| 3.7 | Implement `metadata/resolver.ts` + `ipfs.ts` — async metadata fetch, parse JSON, update collection_tokens | Unit test with IPFS fixture |
| 3.8 | Implement `index.ts` — start all chain loops concurrently, graceful shutdown on SIGINT/SIGTERM | Process starts, connects, polls |
| 3.9 | End-to-end test: local Anvil → deploy factory → deploy collection → mint → indexer catches all events → token appears in DB with resolved metadata | Token in DB with metadata |

### Phase 4: API Endpoints (Next.js)

| # | Task | Verifiable when |
|---|------|----------------|
| 4.1 | `POST /api/collections/deploy` — validate params, encode factory call, return unsigned tx + deploymentId | Curl returns valid txRequest |
| 4.2 | `POST /api/collections/deploy/:deploymentId/submit` — record tx hash, create pending deployment row | Curl creates deployment row |
| 4.3 | `GET /api/collections/deploy/:deploymentId/status` — return deployment status | Curl returns status |
| 4.4 | `GET /api/collections` — list with owner/chain/status filters + pagination | Curl returns paginated list |
| 4.5 | `GET /api/collections/:collectionId` — detail with extensions, royalties, stats | Curl returns full detail |
| 4.6 | `GET /api/collections/:collectionId/tokens` — paginated tokens with metadata | Curl returns tokens |
| 4.7 | `GET /api/collections/:collectionId/tokens/:tokenId` — single token with transfer history | Curl returns token + transfers |
| 4.8 | `GET /api/collections/:collectionId/transfers` — transfer history with pagination | Curl returns transfers |
| 4.9 | `PATCH /api/collections/:collectionId` — update off-chain metadata (description, image, banner) | Curl updates description |

### Phase 5: Integration

| # | Task | Verifiable when |
|---|------|----------------|
| 5.1 | Deploy factory to Sepolia via Foundry script | Factory address confirmed on Etherscan |
| 5.2 | Run indexer against Sepolia | Indexer starts, no errors |
| 5.3 | Deploy collection via API on Sepolia | Collection row in DB, status='active' |
| 5.4 | Mint tokens on Sepolia collection | Tokens appear in DB with resolved metadata |
| 5.5 | Transfer token on Sepolia | Ownership updates in DB, transfer_events row created |

---

## Dependency Graph

```
Phase 1 (contracts) ──→ Phase 3 (indexer) needs ABIs + factory address
Phase 2 (DB) ──────────→ Phase 3 (indexer) needs schema tables
                     └──→ Phase 4 (API) needs schema tables
Phase 1 + 2 + 3 ──────→ Phase 5 (integration)
```

Phase 1 and Phase 2 can run in parallel. Phase 3 starts once both are done. Phase 4 can start once Phase 2 is done (use seeded data for testing). Phase 5 is last.

---

## Progress

| Phase | Status | Commit | Details |
|-------|--------|--------|---------|
| 1. Smart Contracts | Done | `2adfd0f` | 26 tests passing. Foundry, Solidity 0.8.27, OZ 5.2.0. |
| 2. Database | Done | `4811308` | 7 tables in schema.ts, migration 0023 written manually, applied to DB. |
| 3. Indexer | Done | `eadae29` | 10 source files. Factory watcher + collection scanner + metadata resolver. 3 chains (mainnet, base, sepolia). Cursor in indexed_contracts. On-chain totalSupply. |
| 4. API Endpoints | Done | pending | 8 route files, 11 handlers. Deploy flow (encode/submit/status), CRUD reads, ownership-gated PATCH. |
| 5. Integration | Not started | — | Sepolia deployment + end-to-end test. |
