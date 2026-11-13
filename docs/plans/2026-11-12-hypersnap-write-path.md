# Hypersnap / Snapchain write path for casts

**Updated:** 2026-11-13  
**Source:** [Hypersnap writing-messages guide](https://github.com/farcasterorg/hypersnap/blob/main/site/docs/pages/guides/writing-messages.mdx) (same content as Snapchain “Writing to snapchain”), plus [hypersnap.org](https://hypersnap.org/llms-full.txt) HTTP API notes.  
**Implementation plan:** [Signer + clients (web first, native later)](./2026-11-13-hypersnap-signer-and-clients.md)

This answers the open item in the Social plans: *verify Hypersnap auth/signing/publishing before connecting compose*.

---

## Short answer

**Hypersnap’s HTTP `/v2/farcaster/*` API is for reads (and some mini-app/webhook management). It does not publish casts.**

- `POST /v2/farcaster/cast` and related write stubs return **`501 Not Implemented`**.
- Casts (and reactions/follows) are **signed Farcaster protocol messages** submitted to a **Snapchain/Hub node** via gRPC `SubmitMessage` (or the Hub HTTP message endpoint that accepts protobuf bytes).
- After a message merges, our existing Hypersnap **read** base (`https://haatz.quilibrium.com/v2/farcaster`) can show it once that node has ingested it.

So: **read via Hypersnap HTTP; write via Snapchain submit with a registered signer.**

---

## What the writing guide actually enables

### Two keypairs

| Key | Role |
|-----|------|
| **Custody** | ETH account that owns the FID (Optimism). Signs gasless `KEY_ADD` / fname proofs. User keeps this. |
| **Signer** | Ed25519 key that signs casts/reactions/links. **App can hold this** once the user authorizes it. |

### Modern path: gasless signers (prefer this)

Instead of an onchain Key Gateway tx:

1. App generates an Ed25519 keypair.
2. Build a `KEY_ADD` with:
   - App `SignedKeyRequest` metadata (binds key to **app FID** — do **not** use the onchain `getSignedKeyRequestMetadata()` domain; use gasless metadata helpers).
   - Custody EIP-712 authorization over **scopes**, **TTL** (≤ 90 days, sliding), and **nonce**.
3. New key signs the `KEY_ADD` envelope (proof of possession).
4. `hubClient.submitMessage(KEY_ADD)` to a writable node — no ETH, ~1s.
5. Scope the key tightly, e.g. `CAST_ADD`, `CAST_REMOVE`, `REACTION_*`, `LINK_*` as needed. A key scoped only to casts cannot follow.

Revoke with `KEY_REMOVE` (custody or self-revoke) or let TTL expire.

### Then publish a cast

```ts
await hubClient.submitMessage(
  (await makeCastAdd(
    { text, embeds, embedsDeprecated: [], mentions: [], mentionsPositions: [], type: CastType.CAST },
    { fid, network: FarcasterNetwork.MAINNET },
    ed25519Signer,
  ))._unsafeUnwrap(),
);
```

Embeds can carry URLs / NFT deep links for “discuss this minted work” without ownership.

### Node write access

**Update (2026-11-13):** public **haatz** accepts protocol submits over HTTPS Hub API — see [haatz research](./2026-11-13-haatz-submit-research.md).

| Path | Works on haatz? |
|------|-----------------|
| `POST /v2/farcaster/cast` (JSON) | No — `501` |
| `POST /v1/submitMessage` (protobuf octet-stream) | **Yes** — no API key; live `400` on bad/empty body proves the handler |
| gRPC `:3383` SubmitMessage | Not publicly reachable on haatz (use HTTPS `/v1/…`) |

Still required: a correctly signed `Message` (authorized signer). Options if we outgrow public haatz: own read node, validator (e.g. imgnAI), or a managed submit API (Neynar-style) that still needs a signer under the hood.

---

## Mapping onto cryptoart.social

**Scaffold (this branch):** Social desk now has a gated write path that runs **in parallel** with factory preview deploy work.

| Piece | Path / env | Status |
|-------|------------|--------|
| Read client | `HYPERSNAP_BASE_URL` → feed/account middleware | Live |
| Submit client | `SNAPCHAIN_SUBMIT_URL` (+ optional `SNAPCHAIN_SUBMIT_AUTH`) → `snapchainSubmit.ts` | Scaffolded |
| Compose API | `GET/POST /api/cryptoart/compose`, `GET /api/cryptoart/compose/status` | Scaffolded; publish gated |
| Compose UI | `/compose` in desk `Shell` + header tab | Scaffolded; shows blockers |
| Signer gate | `CRYPTOART_SIGNER_READY=true` after KEY_ADD; optional `CRYPTOART_APP_FID` | Not wired yet |

`POST /api/cryptoart/compose` without `SNAPCHAIN_SUBMIT_URL` returns **202** (draft acknowledged, not submitted). With submit URL but no `signedMessageHex` (and no ready gasless signer path) it returns **501**. When both submit URL and hex-encoded signed `Message` protobuf are present, bytes are forwarded as `application/octet-stream` to `{SNAPCHAIN_SUBMIT_URL}/v1/submitMessage`.

### Default submit plug-in (haatz)

1. Set `SNAPCHAIN_SUBMIT_URL=https://haatz.quilibrium.com` (no trailing slash).
2. Leave `SNAPCHAIN_SUBMIT_AUTH` unset on public haatz.
3. Keep `HYPERSNAP_BASE_URL=https://haatz.quilibrium.com/v2/farcaster` for reads (same host).
4. After gasless `KEY_ADD` + vault, wire `makeCastAdd` (today scaffold: `signedMessageHex` BYO).

Optional later: imgnAI / self-hosted node if we need private rate limits or stronger ingest guarantees. Factories remain independent.

### Minimal product slice (remaining)

1. **Session** — FID + custody (SIWE / directory; partly there).
2. **App identity** — Cryptoart app FID + custody key for `SignedKeyRequest` metadata (`CRYPTOART_APP_FID`).
3. **Authorize signer** — UI: “Allow Cryptoart to post” → custody signs gasless `KEY_ADD` → store encrypted app signer material.
4. **Compose** — build `CastAdd` (text + optional artwork embed) → submit (scaffold accepts pre-signed hex today).
5. **Read-back** — Hypersnap HTTP until the cast appears in feed/profile.

### Explicit non-goals from this guide alone

- Creating brand-new FIDs for every collector (most users already have FIDs).
- Treating Hypersnap `/v2/farcaster/cast` as the write API.
- Using the **deprecated onchain** key-gateway flow for new app signers (gas + OP block latency).

---

## Decisions still open (do not block scaffold)

Planning defaults (web first, native tagged later) are recorded in [2026-11-13-hypersnap-signer-and-clients.md](./2026-11-13-hypersnap-signer-and-clients.md). Remaining provider/TTL choices:

1. **Writable node provider** — imgnAI validator vs self-hosted Snapchain vs managed API.
2. **App FID** — dedicated Cryptoart FID for request metadata (required before authorize UI).
3. **Scopes + TTL** — start with cast/reaction only; 30-day sliding TTL as in the guide example.

`/compose` stays gated until submit URL + signer are ready; Hypersnap reads continue as today.
