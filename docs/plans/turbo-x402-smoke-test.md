# Turbo x402 smoke test (Studio preview)

Manual checklist for validating the **artist-paid** Turbo x402 pin flow on a **Vercel preview** of project **`cryptoart-studio`** (domain `cryptoart.studio` / preview URL). Pair with the local CLI in `apps/studio/scripts/turbo-x402-smoke.ts` if you want to validate Turbo settlement before using the browser UI.

**Related code:** PR #206 · branch `cursor/turbo-x402-direct-upload-8f86`.

---

## 1. Vercel preview environment

Set these on **Preview** (and Production when ready) for project **`cryptoart-studio`** (not `cryptoart-studio-mvp`).

### Set (Base Sepolia)

| Variable | Preview value |
|----------|----------------|
| `CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT` | `false` |
| `CRYPTOART_MEDIA_NETWORK` | `eip155:84532` |
| `CRYPTOART_MEDIA_ASSET` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `STORAGE_POSTGRES_URL` | *(existing Postgres URL)* |
| `CHAIN_84532_FACTORY_ADDRESS` | *(per [2026-11-13-base-sepolia-preview-env.md](./2026-11-13-base-sepolia-preview-env.md))* |
| `CHAIN_84532_ERC1155_FACTORY_ADDRESS` | *(same doc)* |
| `CHAIN_84532_START_BLOCK` | *(same doc)* |
| `CHAIN_84532_RPC_URL` | *(Base Sepolia RPC)* |

Optional:

| Variable | When |
|----------|------|
| `CRYPTOART_MEDIA_TURBO_UPLOAD_URL` | Omit → `https://upload.ardrive.io`. Only set if intentionally targeting ar.io sandbox. |

### Remove (legacy treasury upload)

Delete if still present:

- `TURBO_PRIVATE_KEY`
- `X402_FACILITATOR_URL` / `X402_FACILITATOR_TOKEN`
- `CRYPTOART_MEDIA_PAY_TO`
- `CRYPTOART_MEDIA_USDC_NAME` / `CRYPTOART_MEDIA_USDC_VERSION`

Redeploy the preview after env changes.

---

## 2. Wallet funding (Base Sepolia USDC)

1. Use a **dedicated test wallet** (not your mainnet artist wallet).
2. Add **Base Sepolia** in the wallet (chain id `84532`, RPC from `CHAIN_84532_RPC_URL` or a public Sepolia Base RPC).
3. Obtain **Base Sepolia ETH** for gas from a Base Sepolia faucet (e.g. [Coinbase Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) or [Alchemy Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia)).
4. Obtain **Base Sepolia USDC** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`):
   - Circle / Coinbase testnet USDC faucets when available, or
   - Bridge from Sepolia ETH testnets if your ops runbook specifies one, or
   - Transfer from an internal ops wallet that already holds preview USDC.
5. Keep at least **~0.50 USDC** on the wallet (two small x402 uploads + headroom).

---

## 3. UI smoke: `/media/upload`

Open the preview URL → **Pin to Arweave** (`/media/upload`).

| Step | Action | Expected |
|------|--------|----------|
| A | Load page | Banner mentions **turbo-x402** (not “TURBO_PRIVATE_KEY required”). `/api/media/config` → `uploadMode: "turbo-x402"`, `allowMockPayment: false`. |
| B | Connect wallet + **Create SIWE session** | Session shows your address on Base Sepolia. |
| C | Choose a small image (e.g. &lt; 500 KB), set title, **Get quote** | `POST /api/media/quote` → **200** with `quote.usdcAmount`, `mediaUsdcAmount`, `metadataUsdcAmount`, `network: "eip155:84532"`. |
| D | **Pay Turbo and pin** | Wallet prompts **twice** (media, then metadata). Log lines show Arweave ids. |
| E | After confirm | Log ends with mint-ready message; page shows `ar://` links and **Mint can use the metadata URI.** |
| F | `GET /api/media/jobs/{id}` | `mintEnabled: true`, `pin.metadataUri` set, `job.status: "confirmed"`. |

### Network tab (representative)

- `POST /api/media/jobs` → **201**, `job.status: "paid"`, `payment.facilitator: "turbo-x402"`.
- Direct browser call to `https://upload.ardrive.io/v1/x402/data-item/unsigned` (via x402-fetch) → **200/201** with JSON containing `id`.
- `POST /api/media/jobs/{id}/media` → **200** with `{ record: ... }` body (no base64).
- `POST .../metadata` → **200** with `{ record: ... }`.
- `POST .../confirm` → **200**, `mintEnabled: true`.

---

## 4. Gateway verification

For **media id** and **metadata id**:

1. `https://arweave.net/{id}` — should return **200** (GET or HEAD) once propagated (may take 1–15 minutes).
2. `https://ar-io.net/{id}` — same.

Studio’s confirm step only marks **mintEnabled** when at least one gateway HEAD succeeds for **both** items.

---

## 5. Mint + list (downstream)

Prerequisites: a **Base Sepolia** collection using factory env from [2026-11-13-base-sepolia-preview-env.md](./2026-11-13-base-sepolia-preview-env.md).

1. Go to **Collections → [collection] → Mint**.
2. Attach the pin job id (or paste metadata `ar://` if the UI supports it) — mint page should read `usePinnedMedia` and show the metadata URI when `mintEnabled` is true.
3. Complete mint transaction on Base Sepolia.
4. Open the minted token and use **List this token** — listing form should accept the metadata-backed token URI.

---

## 6. Negative checks

### Mock payment hard-deny (production-shaped preview)

With `CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false`:

```bash
# After a real quote + session cookie, or via API with payer session:
curl -si -X POST "$PREVIEW/api/media/jobs" \
  -H 'cookie: <siwe-session>' \
  -H 'content-type: application/json' \
  -H 'x-payment: mock:allow' \
  -d '{"idempotencyKey":"<key>","quote":{...}}'
```

Expect **403**, body `code: "mock_payment_disabled"`.

### Underpaid quote

1. Get a quote for file A.
2. Tamper `quote.usdcAmount` to `1` before `POST /api/media/jobs`.

Expect **400**, error contains **does not cover the current Turbo price**.

### Expired quote

Use a quote whose `expiresAt` is in the past.

Expect **400**, **Quote expired** (or unknown quote).

### Server upload without mock

With mock off, `POST .../media` with `{ bytes: "..." }` only.

Expect **400**, message to upload via Turbo x402 and submit `{ record }`.

---

## 7. Local Turbo CLI (optional pre-flight)

On a dev machine (not CI):

```bash
export TURBO_X402_SMOKE_PRIVATE_KEY=0x...   # throwaway Base Sepolia wallet — never commit
pnpm --filter studio smoke:turbo-x402 -- --help
pnpm --filter studio smoke:turbo-x402
pnpm --filter studio smoke:turbo-x402 -- --mainnet   # only if Sepolia x402 does not settle
```

See script output for **PASS** / **FAIL** and the Arweave transaction id.

---

## Pass criteria

- [ ] Preview env has new media vars and **no** legacy treasury/Turbo operator keys.
- [ ] Two x402 USDC payments succeed from the artist wallet.
- [ ] Both `ar://` items eventually readable on **arweave.net** and **ar-io.net**.
- [ ] `mintEnabled` true after confirm.
- [ ] Mint + **List this token** work with pinned metadata URI.
- [ ] Mock header **403**; underpaid/expired quotes **400**; raw bytes upload **400** when mock is off.