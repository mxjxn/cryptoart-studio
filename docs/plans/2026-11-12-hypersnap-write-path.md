# Hypersnap / Snapchain write path for casts

**Updated:** 2026-11-12  
**Source:** [Hypersnap writing-messages guide](https://github.com/farcasterorg/hypersnap/blob/main/site/docs/pages/guides/writing-messages.mdx) (same content as Snapchain “Writing to snapchain”), plus [hypersnap.org](https://hypersnap.org/llms-full.txt) HTTP API notes.

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

The guide assumes **write access to a Snapchain/Hub node**. Public Hypersnap HTTP reads (e.g. haatz) are not that. Options:

1. Run or buy a **writable** Snapchain/Hub endpoint (gRPC `SubmitMessage`, often auth’d).
2. Use a **hosted submit API** (e.g. Neynar-style) that wraps the same protocol — still needs a user-authorized signer under the hood.
3. Do **not** expect `HYPERSNAP_BASE_URL` alone to accept cast POSTs.

---

## Mapping onto cryptoart.social

Current code (`apps/social/web/src/cryptoart/server.ts`) only **reads** Hypersnap feeds. Compose is blocked on write verification — that was correct.

### Minimal product slice

1. **Session** — know FID + custody address (wallet SIWE / verified address → FID directory; already partly there).
2. **App identity** — Cryptoart app FID + custody key (server secret) for `SignedKeyRequest` metadata.
3. **Authorize signer** — UI: “Allow Cryptoart to post” → custody signs gasless `KEY_ADD` → store encrypted app signer material server-side (or device-held if we refuse custody of keys).
4. **Compose** — server or client builds `CastAdd` (text + optional artwork embed URL) → `submitMessage` to writable node.
5. **Read-back** — poll/list via Hypersnap HTTP until the cast appears in feed/profile.

### Explicit non-goals from this guide alone

- Creating brand-new FIDs for every collector (most users already have FIDs).
- Treating Hypersnap `/v2/farcaster/cast` as the write API.
- Using the **deprecated onchain** key-gateway flow for new app signers (gas + OP block latency).

---

## Decisions still needed before coding compose

1. **Writable node provider** — self-hosted Snapchain, third-party Hub with submit, or managed API.
2. **Signer custody model** — app-held gasless signer (simpler UX) vs user-device signer (harder, less trust).
3. **App FID** — dedicated Cryptoart FID for request metadata (required for proper gasless `SignedKeyRequest`).
4. **Scopes + TTL** — start with cast/reaction only; 30-day sliding TTL as in the guide example.

Until those are chosen, keep `/compose` gated and keep reading from Hypersnap as today.
