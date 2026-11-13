# haatz.quilibrium.com — posting endpoint research

**Updated:** 2026-11-13  
**Host:** `https://haatz.quilibrium.com` (public Hypersnap / Quilibrium node; Hypersnap docs’ default example host)  
**Probed live:** 2026-11-13 from cloud agent  

Companions: [write-path](./2026-11-12-hypersnap-write-path.md) · [signer plan](./2026-11-13-hypersnap-signer-and-clients.md) · [relaunch to-do](./2026-11-13-relaunch-todo.md)

---

## Short answer

**We can post through haatz.** Not via `/v2/farcaster/cast` — via Hub HTTP:

```http
POST https://haatz.quilibrium.com/v1/submitMessage
Content-Type: application/octet-stream

<signed Farcaster Message protobuf bytes>
```

- **No API key / Authorization required** on the public host (empty or Bearer both work for reads; submit accepts unauthenticated bodies and validates the protobuf).
- **Public gRPC `:3383` is closed/filtered** from the open internet — use HTTPS `:443` `/v1/submitMessage`, not raw gRPC to haatz.
- You still need a **valid authorized Ed25519 signer** for the user’s FID (gasless `KEY_ADD` or on-chain). The node does not invent credentials; it only accepts correctly signed protocol messages.

So for Social compose: set `SNAPCHAIN_SUBMIT_URL=https://haatz.quilibrium.com` (optional auth unset). `HYPERSNAP_BASE_URL` can stay `https://haatz.quilibrium.com/v2/farcaster` for reads on the same host.

---

## What haatz is

| Fact | Detail |
|------|--------|
| Role | Public Hypersnap node used in [hypersnap.org](https://hypersnap.org/docs/introduction) examples |
| Listeners (typical) | HTTP (docs default `:3381`; haatz fronts **443** via Cloudflare) + gRPC (`:3383`, not publicly reachable on haatz) |
| Reads | Unauthenticated `/v2/farcaster/*` and Hub `/v1/*` |
| Writes (v2 JSON) | Registered but **`501 Not Implemented`** — message body tells you to use SubmitMessage |
| Writes (protocol) | Hub HTTP **`POST /v1/submitMessage`** (+ `POST /v1/validateMessage`) |

Live `/v1/info` (excerpt): Hypersnap `version` `0.17.6`, ~914M messages, multi-shard, healthy enough for public use. CORS: `access-control-allow-origin: *`.

---

## Live probes (2026-11-13)

| Request | Result |
|---------|--------|
| `GET /v1/info` | `200` JSON, no auth |
| `POST /v2/farcaster/cast` JSON | `501` — *“Write operations require submitting signed Farcaster messages via the gRPC SubmitMessage endpoint”* (wording says gRPC; HTTP Hub submit still works) |
| `POST /v1/submitMessage` empty / junk bytes | `400` with protobuf validation error (`fid cannot be 0` / invalid message) — **endpoint is live**, not 401/404/501 |
| `POST /v1/validateMessage` empty | `400` `No message data` |
| TCP `haatz.quilibrium.com:3383` | Closed/filtered |
| TCP `:443` | Open |

Interpretation: official Hypersnap docs emphasize gRPC `SubmitMessage`; on haatz the practical public write path is **HTTPS Hub submit**. Empty-body `400` proves the server is decoding Message protos, not gating on a token.

---

## Requirements to actually publish

### 1. Transport

| Req | Value |
|-----|--------|
| URL | `https://haatz.quilibrium.com/v1/submitMessage` |
| Method | `POST` |
| Body | Raw protobuf `Message` bytes |
| Content-Type | `application/octet-stream` |
| Auth header | **None** on public haatz |
| Optional preflight | `POST /v1/validateMessage` with same body |

Compatible with our scaffold: `SNAPCHAIN_SUBMIT_URL=https://haatz.quilibrium.com` → client appends `/v1/submitMessage`.

### 2. Message / signer (still required)

Same as [write-path](./2026-11-12-hypersnap-write-path.md) / [signer plan](./2026-11-13-hypersnap-signer-and-clients.md):

1. User has an FID (custody on Optimism).
2. App holds or uses an Ed25519 signer authorized for that FID (`KEY_ADD` gasless preferred).
3. Build + sign `CastAdd` (or `KEY_ADD`, reaction, link, …) with that signer.
4. POST bytes to submit; then **read back** via Hypersnap/Hub (cast may need a moment — read nodes gossip; if gossip drops, resubmit).

haatz does **not** remove the need for app FID + custody authorize + signer vault. It only removes “find a private writable node / imgnAI URL” as a blocker for protocol submit.

### 3. Guest behavior

Public node — be a good guest ([phunk tutorial](https://docs.phunk.social/tutorial.html)):

- Rate-limit client-side (phunk defaults ~20 rps / 12 in flight; lower for bulk).
- Expect retries on 429 / 5xx / timeouts.
- Prefer own node later for heavy write volume or guaranteed ingest; haatz is fine to start.

### 4. What is *not* a req on public haatz

- API key / `SNAPCHAIN_SUBMIT_AUTH` (unless Quilibrium later puts the node behind a gateway).
- Open gRPC to the internet.
- Neynar (or other) as the write broker — optional alternative, not required if we submit signed messages ourselves.
- Pointing `HYPERSNAP_BASE_URL` at a different host for reads (same host can do both).

---

## Doc conflict note

| Source | Claim |
|--------|--------|
| hypersnap.org / llms-full | Writes via **gRPC** SubmitMessage; v2 cast POST = 501 |
| Snapchain Hub HTTP | `POST /v1/submitMessage` octet-stream (standard Hub API) |
| phunk tutorial | haatz is the example node; read nodes accept `/v1/submitMessage` and gossip to validators |
| Some third-party notes (e.g. ZAO research) | “haatz is read-only / keep writes on Neynar” — **outdated relative to live `/v1/submitMessage`** |
| Our earlier plans | Suggested imgnAI / separate submit URL as likely required — **softened**: haatz itself is a viable public submit base |

---

## Implication for Cryptoart

| Item | Update |
|------|--------|
| Operator “get submit URL” | Default candidate is already known: **haatz** |
| `SNAPCHAIN_SUBMIT_URL` | `https://haatz.quilibrium.com` |
| `SNAPCHAIN_SUBMIT_AUTH` | Leave unset unless host changes policy |
| Remaining blocker for compose | **Signer Phase A** (app FID, gasless KEY_ADD, vault, `makeCastAdd`) — not discovery of a write host |
| imgnAI | Optional later (dedicated validator / SLAs); not required to unblock submit wiring |

---

## References

- [Hypersnap introduction](https://hypersnap.org/docs/introduction) — haatz as public node  
- [hypersnap.org/llms-full.txt](https://hypersnap.org/llms-full.txt) — v2 writes = 501; SubmitMessage for casts  
- [phunk “Reading Farcaster through a node”](https://docs.phunk.social/tutorial.html) — haatz, `/v1/submitMessage`, gasless keys, guest rates  
- Hub HTTP submit (Snapchain / Hubble-compatible): `POST /v1/submitMessage`  
