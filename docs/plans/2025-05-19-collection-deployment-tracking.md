# Collection Deployment & Server-Side Tracking

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Artists deploy their own NFT collections through our factory contract. Backend tracks every deployment, token, and owner — no subgraph, no third-party watchers.

**Architecture:** Our own ERC721 contract + factory (inspired by Manifold's patterns but our code). Artist signs deployment via wallet. Backend constructs the tx, watches the receipt, records in DB. RPC for on-demand on-chain reads.

**Tech Stack:** Solidity 0.8.27, Foundry, Drizzle ORM (Postgres), viem/ethers for backend tx construction

---

## Resolved Decisions

| Decision | Rationale |
|----------|-----------|
| **Own contracts, not Manifold's** | Manifold runs watcher on proxied deployments. Using their code means their automated systems track us (they sent emails on our auctions). We want full independence. |
| **No subgraph** | Backend DB is source of truth for collection discovery. RPC for on-demand reads. Simpler, sufficient for our scale. |
| **Artist signs via wallet** | Artist initiates deployment from frontend. Backend constructs the tx params, frontend sends via wallet connection. Backend watches receipt. No custodial signing. |
| **Factory emits events** | `CollectionCreated(address, address, string, string)` — our factory, our events. Indexable if we ever want it. |
| **Network order: Sepolia → Base → mainnet** | Test first on Sepolia, deploy to Base for production, mainnet later. |

---

## Smart Contracts

### 1. `SuchCollection` — ERC721 Collection Contract

Each artist gets their own instance. Minimal, gas-efficient.

```
contract SuchCollection is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    // ─── Storage ──────────────────────────────────────
    uint256 public totalSupply;
    string  private _baseURI;
    
    // Per-token metadata (set at mint time)
    mapping(uint256 => string) private _tokenURIs;
    
    // Extension pattern (simplified from Manifold)
    // Extensions are contracts that can mint tokens
    struct Extension {
        bool registered;
        string baseURI;
    }
    mapping(address => Extension) private _extensions;
    address[] private _extensionList;
    
    // Royalty (EIP-2981)
    address payable private _royaltyReceiver;
    uint16 private _royaltyBPS;  // max 50% = 5000
    
    // ─── Events ───────────────────────────────────────
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event ExtensionRegistered(address indexed extension, string baseURI);
    event ExtensionUnregistered(address indexed extension);
    event BaseURIUpdated(string baseURI);
    event RoyaltyUpdated(address receiver, uint16 bps);
    
    // ─── Functions ────────────────────────────────────
    constructor(string memory name, string memory symbol, address owner, 
                address payable royaltyReceiver, uint16 royaltyBPS);
    
    // Minting — only owner or registered extensions
    function mint(address to, string calldata uri) external returns (uint256);
    function mintBatch(address[] calldata to, string[] calldata uris) external returns (uint256[] memory);
    
    // Extension management — owner only
    function registerExtension(address extension, string calldata baseURI) external;
    function unregisterExtension(address extension) external;
    
    // Metadata
    function tokenURI(uint256 tokenId) external view returns (string);
    function setBaseURI(string calldata baseURI) external;
    
    // Royalty (EIP-2981)
    function setRoyalty(address payable receiver, uint16 bps) external;
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
    
    // View
    function getExtensions() external view returns (address[] memory);
    function supportsInterface(bytes4) external view returns (bool);
}
```

**Key differences from Manifold:**
- No blacklist mechanism (YAGNI — we control our own extensions)
- No approve-transfer hooks (simpler, no reentrancy surface)
- No `baseURIIdentical` flag (just use tokenURI directly)
- No multi-royalty array (single receiver + BPS — simpler, EIP-2981 standard)
- Enumerable by default (we need it for gallery rendering)
- Solidity 0.8.27 (Manifold uses 0.8.17)

### 2. `SuchCollectionFactory` — Deploys Collections

```
contract SuchCollectionFactory is Ownable {
    // ─── State ────────────────────────────────────────
    address[] public collections;
    mapping(address => address) public collectionOwner;  // collection => artist
    mapping(address => address[]) public artistCollections;  // artist => collections[]
    
    // ─── Events ───────────────────────────────────────
    event CollectionCreated(
        address indexed collection,
        address indexed owner,
        string name,
        string symbol
    );
    
    // ─── Functions ────────────────────────────────────
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

**Notes:**
- Uses `new SuchCollection(...)` — deterministic via CREATE, not CREATE2. If we need CREATE2 later, we add it.
- `msg.sender` becomes the collection owner (artist's wallet).
- Factory owner is our platform — can add platform-level constraints later.
- No deployment proxy / Yul — we don't need Manifold's gas gymnastics for our scale.

---

## Database Schema

Add to `packages/db/src/schema.ts`:

### `collections` table

```typescript
export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Identity
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  
  // On-chain
  chainId: integer('chain_id').notNull().default(8453),       // Base default
  contractAddress: text('contract_address').notNull(),         // lowercase
  factoryAddress: text('factory_address').notNull(),           // the factory that deployed it
  deployTxHash: text('deploy_tx_hash').notNull(),              // deployment transaction hash
  deployBlockNumber: bigint('deploy_block_number', { mode: 'number' }),
  
  // Ownership
  ownerAddress: text('owner_address').notNull(),               // artist wallet (lowercase)
  
  // Royalty config at deploy time
  royaltyReceiver: text('royalty_receiver'),                   // may differ from owner
  royaltyBPS: integer('royalty_bps').default(0),               // 0-5000
  
  // Metadata
  description: text('description'),
  imageUrl: text('image_url'),                                 // collection banner/logo
  bannerUrl: text('banner_url'),
  
  // Status
  status: text('status').notNull().default('deploying'),       // 'deploying' | 'active' | 'paused' | 'deprecated'
  
  // Stats (denormalized for fast reads)
  totalSupply: integer('total_supply').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),                      // when tx receipt confirmed
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
  
  // Foreign key to collections
  collectionId: uuid('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  
  // On-chain identity
  chainId: integer('chain_id').notNull().default(8453),
  contractAddress: text('contract_address').notNull(),         // denormalized for queries
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(),
  
  // Metadata
  tokenURI: text('token_uri'),
  name: text('name'),                                          // token name (if applicable)
  description: text('description'),
  imageUrl: text('image_url'),
  
  // Ownership
  ownerAddress: text('owner_address').notNull(),               // current owner (lowercase)
  mintTxHash: text('mint_tx_hash').notNull(),                  // minting tx hash
  mintBlockNumber: bigint('mint_block_number', { mode: 'number' }),
  
  // Minting extension (if minted via extension, not collection owner)
  mintedByExtension: text('minted_by_extension'),              // extension address if applicable
  
  // Timestamps
  mintedAt: timestamp('minted_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  contractTokenIdx: uniqueIndex('collection_tokens_contract_token_idx')
    .on(table.contractAddress, table.chainId, table.tokenId),
  collectionIdx: index('collection_tokens_collection_id_idx').on(table.collectionId),
  ownerIdx: index('collection_tokens_owner_address_idx').on(table.ownerAddress),
}));
```

### `collection_deployments` table (tx tracking)

```typescript
export const collectionDeployments = pgTable('collection_deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // The collection (set once tx confirms)
  collectionId: uuid('collection_id'),                         // null until confirmed
  
  // Transaction tracking
  chainId: integer('chain_id').notNull().default(8453),
  txHash: text('tx_hash').notNull(),
  fromAddress: text('from_address').notNull(),                 // artist wallet
  toAddress: text('to_address'),                               // factory address
  
  // Deployment params (stored before tx confirms)
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  royaltyReceiver: text('royalty_receiver'),
  royaltyBPS: integer('royalty_bps').default(0),
  
  // Status
  status: text('status').notNull().default('pending'),         // 'pending' | 'confirmed' | 'failed' | 'timed_out'
  blockNumber: bigint('block_number', { mode: 'number' }),
  gasUsed: bigint('gas_used', { mode: 'number' }),
  effectiveGasPrice: bigint('effective_gas_price', { mode: 'number' }),
  
  // Error tracking
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  
  // Timestamps
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

---

## API Endpoints

### `POST /api/collections/deploy`

**Artist initiates collection deployment.**

```
Request:
{
  "name": "My Art Collection",
  "symbol": "MAC",
  "chainId": 8453,
  "royaltyReceiver": "0x...",    // optional, defaults to artist wallet
  "royaltyBPS": 500              // optional, defaults to 0
}

Response (200):
{
  "txRequest": {
    "to": "0x...",               // factory address
    "data": "0x...",             // encoded createCollection call
    "from": "0x...",             // artist's connected wallet
    "chainId": 8453,
    "gasLimit": "2500000"        // estimated
  },
  "deploymentId": "uuid..."      // for tracking
}
```

**Flow:**
1. Frontend sends params to API
2. Backend validates (name uniqueness per artist, symbol format, BPS range)
3. Backend encodes the factory call data
4. Returns unsigned tx to frontend
5. Frontend prompts wallet signature via wagmi/viem
6. Frontend sends signed tx hash to `POST /api/collections/deploy/:deploymentId/submit`
7. Backend records `collectionDeployments` row with status `pending`
8. Backend watches for receipt (polling or WebSocket)
9. On confirmation: create `collections` row, update deployment status
10. On failure: update deployment status, notify artist

### `POST /api/collections/deploy/:deploymentId/submit`

```
Request:
{
  "txHash": "0x..."
}

Response (200):
{
  "deploymentId": "uuid...",
  "status": "pending",
  "message": "Watching for confirmation..."
}
```

### `GET /api/collections/deploy/:deploymentId/status`

```
Response (200):
{
  "deploymentId": "uuid...",
  "status": "confirmed",         // pending | confirmed | failed | timed_out
  "collectionId": "uuid...",
  "contractAddress": "0x...",
  "txHash": "0x...",
  "blockNumber": 12345,
  "gasUsed": "1842000",
  "confirmedAt": "2025-05-19T..."
}
```

### `GET /api/collections`

```
Query params: ?owner=0x...&chainId=8453&status=active&page=1&limit=20

Response (200):
{
  "collections": [{
    "id": "uuid...",
    "name": "My Art",
    "symbol": "MAC",
    "contractAddress": "0x...",
    "chainId": 8453,
    "totalSupply": 5,
    "status": "active",
    "createdAt": "...",
    "confirmedAt": "..."
  }],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### `GET /api/collections/:collectionId`

```
Response (200):
{
  "id": "uuid...",
  "name": "My Art",
  "symbol": "MAC",
  "contractAddress": "0x...",
  "chainId": 8453,
  "ownerAddress": "0x...",
  "royaltyReceiver": "0x...",
  "royaltyBPS": 500,
  "description": "...",
  "imageUrl": "...",
  "bannerUrl": "...",
  "status": "active",
  "totalSupply": 5,
  "extensions": ["0x..."],
  "createdAt": "...",
  "confirmedAt": "..."
}
```

### `GET /api/collections/:collectionId/tokens`

```
Query params: ?page=1&limit=50&owner=0x...

Response (200):
{
  "tokens": [{
    "id": "uuid...",
    "tokenId": "1",
    "tokenURI": "ipfs://...",
    "name": "Artwork #1",
    "imageUrl": "https://...",
    "ownerAddress": "0x...",
    "mintedAt": "..."
  }],
  "total": 5,
  "page": 1,
  "limit": 50
}
```

### `PATCH /api/collections/:collectionId`

```
Request:
{
  "description": "Updated description",
  "imageUrl": "https://...",
  "bannerUrl": "https://..."
}

Response (200):
{ "success": true }
```

Updates off-chain metadata only. On-chain changes (royalties, extensions) go through wallet-signed txs.

---

## Backend Services

### TxReceiptWatcher

Polls/watches for transaction receipts after deployment.

```
class TxReceiptWatcher {
  // Check pending deployments every 5 seconds
  async pollPendingDeployments(): Promise<void>
  
  // Process a confirmed receipt
  async processReceipt(deploymentId: string, receipt: TransactionReceipt): Promise<void>
  
  // Handle failed tx
  async handleFailure(deploymentId: string, error: string): Promise<void>
  
  // Mark timed-out deployments (>30 min pending)
  async markTimedOut(): Promise<void>
}
```

### CollectionIndexer

On-demand ownership sync via RPC. Not a continuous indexer — called when needed.

```
class CollectionIndexer {
  // Sync token ownership for a collection (RPC calls)
  async syncOwnership(contractAddress: string, chainId: number): Promise<void>
  
  // Fetch token metadata from URI (IPFS/HTTP)
  async fetchTokenMetadata(tokenURI: string): Promise<TokenMetadata>
  
  // Update totalSupply cache
  async updateSupplyCache(collectionId: string): Promise<void>
}
```

---

## File Structure

```
packages/
  collection-contracts/           # NEW — Foundry project
    foundry.toml
    src/
      SuchCollection.sol
      SuchCollectionFactory.sol
      interfaces/
        ISuchCollection.sol
        ISuchCollectionFactory.sol
    test/
      SuchCollection.t.sol
      SuchCollectionFactory.t.sol
    script/
      DeployFactory.s.sol
    
  db/
    src/
      schema.ts                   # ADD: collections, collectionTokens, collectionDeployments
    migrations/
      XXXX_add_collection_tables.sql
```

---

## Task Breakdown

### Phase 1: Contracts (Foundry)

**Task 1:** Scaffold `packages/collection-contracts` Foundry project
- `foundry.toml`, remappings, `.gitmodules` (OZ)
- Verify `forge build` passes with a dummy contract

**Task 2:** Write `ISuchCollection.sol` interface
- Events, mint functions, extension management, royalty, view functions
- Test: `forge build` compiles

**Task 3:** Write `SuchCollection.sol` implementation
- ERC721 + Enumerable + Ownable + ReentrancyGuard
- Constructor, mint, mintBatch, extensions, royalty (EIP-2981)
- Test: unit tests for minting, ownership, extensions, royalties

**Task 4:** Write `SuchCollectionFactory.sol`
- `createCollection`, `getCollectionsByArtist`, events
- Test: deploys collection, tracks mappings, emits events

**Task 5:** Write deploy script `DeployFactory.s.sol`
- Sepolia target, reads factory owner from env
- Test: `forge script --dry-run` succeeds

### Phase 2: Database

**Task 6:** Add `collections`, `collectionTokens`, `collectionDeployments` to `packages/db/src/schema.ts`
- Generate migration
- Verify migration applies cleanly

### Phase 3: Backend API

**Task 7:** Implement `POST /api/collections/deploy`
- Validate params, encode factory call, return unsigned tx

**Task 8:** Implement `POST /api/collections/deploy/:deploymentId/submit`
- Record tx hash, create pending deployment row

**Task 9:** Implement TxReceiptWatcher service
- Poll pending deployments, process receipts, update status

**Task 10:** Implement GET endpoints
- Collection list, detail, tokens, deployment status

### Phase 4: Integration

**Task 11:** End-to-end test on Sepolia
- Deploy factory, deploy collection via API, verify DB records

**Task 12:** Add collection management to frontend (artist dashboard)
- Connect wallet, deploy collection, view collections

---

## Open Questions

1. **Minting permissions model** — Should only the collection owner mint, or should we support extension-based minting from day one? Extension pattern is more flexible but adds complexity. Recommendation: start with owner-only, add extensions when we need them (lazy minting, allowlists, etc.).

2. **Token URI strategy** — IPFS CID stored on-chain, or baseURI + tokenId concatenation? IPFS is more decentralized but requires pinning. Recommendation: support both via `tokenURI` per-token override, with a configurable `baseURI` fallback.

3. **Factory upgradeability** — Should the factory be upgradeable (UUPS proxy) or immutable? Immutable is simpler. Recommendation: immutable factory. If we need a new factory version, deploy a new one and update the backend config.
