# Generative HTML / JavaScript NFTs

Studio supports first-class **generative** works: a self-contained HTML page that renders deterministically from an on-chain seed and artist-defined parameters.

## Metadata

Pin the HTML (and bundled `cryptoart-runtime.js` if not inlined) on Arweave. Token metadata should include:

- `animation_url` — gateway URL or `ar://` id for the HTML artifact
- `animation_mime_type` — `html/generative`
- `content.mime` — `text/html`

The media package sets `animation_mime_type` automatically when `mimeType` is `text/html`.

## On-chain parameters extension

`GenerativeParametersExtension` (Foundry: `packages/collection-contracts/src/extensions/`) is registered on a `SuchCollection` like any creator-core extension.

1. Deploy `GenerativeParametersExtension(collection, artistOwner)` (Max deploys locally).
2. `collection.registerExtension(extension, "")`.
3. Mint via `extension.mint(to, metadataUri, optionalParamsBlob)` — not owner `mint()`.

### Artist parameters

- **Collection-level:** `setCollectionParameter(bytes32 key, bytes32 value)` or `setCollectionParamsBlob(bytes)`.
- **Per-token:** `setTokenParameter(tokenId, key, value)` or `setTokenParamsBlob(tokenId, bytes)` (overrides collection defaults).

Keys are opaque `bytes32` values; Studio can use `ethers.id("artist.hue")`.

### Built-in derived values

`getDerivedValue(tokenId, keccak256("cryptoart.derived.<name>"))` returns `bytes32`:

| Label | Meaning |
| --- | --- |
| `tokenId` | Token id |
| `seed` | `keccak256(tokenId, mintBlockHash, mintIndex)` |
| `mintBlock` / `mintTimestamp` | Mint-time block and timestamp |
| `mintBlockHash` | `blockhash` at mint (zero after 256 blocks — seed still uses stored hash) |
| `mintIndex` | 1-based index of extension mints |
| `extensionMintCount` | Total mints via extension (updates over time) |
| `currentBlock` / `currentTimestamp` | At read time |

**Extensibility:** `registerCustomDerived(key, handler)` where `handler.derive(key, tokenId)` returns `bytes32`.

### tokenURI / animation_url: URL params vs public RPC

| Approach | Pros | Cons |
| --- | --- | --- |
| **Query/hash on `animation_url`** (`?chainId=&extension=&tokenId=&rpcUrl=`) | Works offline in archival viewers; no wallet RPC; deterministic snapshot of *mint-time* params if you freeze query at mint | Long URIs; `currentBlock` / live derived values go stale unless viewers refetch chain |
| **Bare `ar://` URL + live RPC** | Always fresh `currentBlock`, params, and seed from chain; shorter metadata | Requires CORS-enabled public RPC; third-party domains disallowed in strict CSP wallets |
| **Hybrid (recommended)** | Metadata keeps a clean `animation_url`; indexers or the extension API append query params for known hosts; runtime tries URL overrides first, then RPC | Slightly more pipeline logic (indexer can assist later) |

The browser runtime (`$cryptoart`) implements **URL overrides first**, then optional RPC (`extension`, `rpcUrl`, `chainId`, `tokenId` query params). Studio previews set `cryptoart_preview=1` and inject `window.__CRYPTOART_PREVIEW__` (no RPC).

## JavaScript runtime (`window.$cryptoart`)

Shipped at `/generative/cryptoart-runtime.js` (studio) and mirrored under `packages/generative/`.

- `$cryptoart.ready` — await before reading chain-backed values
- `$cryptoart.seed`, `$cryptoart.random()`, `$cryptoart.param(key, fallback)`
- `$cryptoart.derived(label)` / `$cryptoart.loadDerived(label)` (live mode + ethers)
- `$cryptoart.notifyReady()` — call when rendering is complete (preview capture hook)
- `window.cryptoartPreviewCapture` — optional; Studio sets this for thumbnails

## Authoring checklist

1. **Self-contained** — no CDN scripts in production; bundle runtime + libraries into the pin.
2. **Responsive** — size to `100vw` / `100vh` or listen to `resize`.
3. **Deterministic** — drive all randomness from `$cryptoart.random()` (seeded).
4. **Network** — only public RPC when needed; no analytics or third-party APIs.
5. **Preview hook** — call `$cryptoart.notifyReady()` when the frame is stable.

Starter templates live in `@cryptoart/generative` (`p5-starter`, `canvas-webgl`, `svg-starter`).