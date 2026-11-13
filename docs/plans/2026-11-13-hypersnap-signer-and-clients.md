# Hypersnap write path — signer plan (web first, native later)

**Updated:** 2026-11-13  
**Status:** Plan (not implemented beyond compose scaffold)  
**Companion:** [Relaunch to-do](./2026-11-13-relaunch-todo.md) · [Hypersnap write-path verification](./2026-11-12-hypersnap-write-path.md) · [Social-first layout](./2026-11-02-social-first-layout.md) · [Social product](./2026-10-29-social-product-and-implementation.md)

---

## Goal

Ship **cast publishing on cryptoart.social (web)** with a durable auth/signing model that the same backend can later serve to **native Apple and Android** clients.

Web is the build target now. Native is a **tagged future client**, not a parallel delivery track for relaunch.

```
Wallet / FID session  →  authorize signer (gasless KEY_ADD)
                      →  compose CastAdd (server or device)
                      →  Snapchain submitMessage
                      →  Hypersnap HTTP reads (feed)
```

---

## Product decision (locked for planning)

| Decision | Choice |
|----------|--------|
| Primary client | **Web** desk (`apps/social`) — `/compose` + feed |
| Future clients | **Native iOS + Android** — same protocol APIs; no separate write stack |
| Signer model (default) | **App-held gasless Ed25519 signer** (custody authorizes once; app posts within scope/TTL) |
| Alternate (later option) | Device-held signer for power users / higher assurance |
| Read vs write | Hypersnap HTTP **reads**; writable Snapchain/Hub **submit** (e.g. imgnAI) |
| Out of scope here | Factories, Studio mint, onchain Key Gateway (deprecated path) |

App-held is the default because web *and* eventual native both get “Allow Cryptoart to post” once, then compose without re-prompting custody every cast. Device-held remains a documented alternative if we refuse server custody of user signers.

---

## Current state (branch tip)

| Piece | State |
|-------|--------|
| Hypersnap feed/account reads | Live |
| `SNAPCHAIN_SUBMIT_URL` client + `/api/cryptoart/compose*` | Scaffolded, gated |
| `/compose` UI | Scaffolded; shows blockers |
| Gasless `KEY_ADD` / app FID / encrypted signer store / `makeCastAdd` | **Not built** |
| Native apps | **Not started** — future tag only |

---

## Architecture (web now)

### Components

1. **Identity session** — wallet SIWE (or equivalent) → custody address → FID (directory already partial).
2. **App identity** — dedicated Cryptoart **app FID** + app custody key (server secret) for gasless `SignedKeyRequest` metadata.
3. **Authorize signer (one-shot UX)** — app generates per-user Ed25519 key → user custody signs EIP-712 scopes/TTL/nonce → submit `KEY_ADD` to writable node.
4. **Signer vault** — encrypt and store per-FID signer material + expiry + scopes (server-side for app-held model).
5. **Compose** — authenticated web request → `makeCastAdd` with stored signer → `POST {SNAPCHAIN_SUBMIT_URL}/v1/submitMessage`.
6. **Read-back** — existing Hypersnap HTTP feed/profile until the cast appears.

### Env / secrets (web + API)

| Name | Role |
|------|------|
| `HYPERSNAP_BASE_URL` | Public read API (unchanged) |
| `SNAPCHAIN_SUBMIT_URL` | Writable submit base |
| `SNAPCHAIN_SUBMIT_AUTH` | Optional Authorization for submit |
| `CRYPTOART_APP_FID` | App FID for SignedKeyRequest metadata |
| App custody private key | Signs request metadata (highest sensitivity) |
| Signer vault key / KMS | Encrypts per-user Ed25519 secrets at rest |

Do **not** point reads at the validator unless it also serves the `/v2/farcaster` read surface.

### Security bar (required for app-held)

- Signer private keys **never** in the browser or in native app binaries for the default model.
- Encrypt at rest (KMS or sealed secrets); access only from compose/authorize services.
- Scope tightly: start with `CAST_ADD` / `CAST_REMOVE` (+ reactions only if product needs them).
- Sliding TTL (e.g. ≤ 30–90 days per Hypersnap guide); refresh via re-auth, not infinite keys.
- Compose endpoints require session; rate-limit submit; audit authorize/revoke.
- User-visible **revoke** (`KEY_REMOVE` + delete vault row).
- App custody key: separate from deploy/factory keys; rotate plan; least privilege hosts.

Compromise model: leaked **user signer** → can post as that FID until revoke/TTL. Leaked **app custody** → can bind malicious app metadata to new KEY_ADDs — treat as break-glass.

---

## Delivery phases

### Phase A — Web write path (relaunch-adjacent)

1. Obtain writable submit URL (+ auth) — parallel to factory preview; does not block factories.
2. Stand up Cryptoart app FID + custody secret in server env (no `.env` commits).
3. Implement authorize flow UI + API (`KEY_ADD` gasless).
4. Implement signer vault + `makeCastAdd` on `POST /api/cryptoart/compose`.
5. Ungate `/compose` when session + authorized signer + submit URL are ready.
6. Reactions/replies follow the same submit path once casts work.

**Acceptance:** logged-in web user authorizes once, publishes a text (+ optional artwork embed) cast, sees it via Hypersnap read within normal network delay; can revoke.

### Phase B — Harden for production web

- KMS-backed vault, key rotation runbook, revoke-all, abuse/rate limits.
- Monitoring on submit failures and authorize funnel.
- Optional: device-held signer path for users who decline app-held keys.

### Phase C — Native clients (future tag)

**Not required for web relaunch.** When started:

- Reuse the **same** authorize + compose + submit HTTP APIs (or thin native SDK over them).
- Native apps are additional **frontends**; they do not get a second Snapchain write stack.
- Prefer continuing **app-held** signers via the backend so iOS/Android do not each invent key storage — unless Phase B’s device-held path is chosen product-wide.
- Push notifications / deep links are a separate native product decision; cast auth is not.

Suggested native sequencing (when tagged work starts): shared API contract → iOS → Android (or dual with one shared networking layer). Exact stack (Swift/Kotlin vs RN/Expo) is **undecided** and should not block Phase A.

---

## Explicit non-goals

- Native App Store / Play release as part of the current Social + Studio factory relaunch.
- Using Hypersnap `POST /v2/farcaster/cast` as the write API (501 / not the protocol path).
- Creating FIDs for every collector as a prerequisite (most users already have FIDs).
- Coupling signer work to ERC-721/1155 factory deploy keys or Base Sepolia preview.

---

## Open decisions (do not block Phase A design)

1. Exact submit provider (imgnAI validator vs other Hub) — only URL + auth shape matter to code.
2. Whether reactions/follows ship in the first authorize scope or casts-only.
3. Vault technology (platform KMS vs app-level encryption with wrapped DEK).
4. Native stack when Phase C starts.

---

## Related code (today)

- `apps/social/web/src/cryptoart/snapchainSubmit.ts` — submit client
- `apps/social/web/src/cryptoart/compose.ts` — gated compose API
- `apps/social/web/src/cryptoart/ComposePage.tsx` — gated UI
- `docs/plans/2026-11-12-hypersnap-write-path.md` — protocol verification notes
