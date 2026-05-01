/**
 * Time IPFS resolution across your configured gateway(s) and public fallbacks.
 *
 * Pinata note: a *dedicated* gateway usually resolves any CID the IPFS network can
 * supply, not only CIDs you pinned — unless the gateway is set to *restricted*
 * (Pinata UI: only pinned content). A *JWT / access token* gates who can use your
 * gateway hostname; it does not by itself mean "my pins only".
 *
 * Usage (from apps/mvp, with env loaded yourself — do not commit secrets):
 *   cd apps/mvp
 *   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/ipfs-gateway-benchmark.ts "ipfs://Qm.../metadata.json"
 *   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/ipfs-gateway-benchmark.ts "https://ipfs.io/ipfs/bafy.../media" --timeout=120000
 *
 * Or: pnpm exec tsx scripts/ipfs-gateway-benchmark.ts <url-or-cid> [--timeout=60000]
 */

function normalizeBase(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  return url.trim().replace(/\/+$/, '');
}

function parseTarget(raw: string): { cid: string; subpath: string } {
  const t = raw.trim();
  if (t.includes("/ipfs/")) {
    try {
      const u = new URL(t);
      const after = u.pathname.split("/ipfs/")[1] || "";
      const parts = after.split("/").filter(Boolean);
      if (parts.length === 0) throw new Error("no CID after /ipfs/");
      const cid = parts[0]!;
      const rest = parts.slice(1);
      return { cid, subpath: rest.length ? `/${rest.join("/")}` : "" };
    } catch {
      throw new Error(`Invalid URL: ${raw}`);
    }
  }
  if (t.startsWith("ipfs://")) {
    const rest = t.slice("ipfs://".length).replace(/^\/+/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) throw new Error("empty ipfs:// path");
    const cid = parts[0]!;
    const restParts = parts.slice(1);
    return { cid, subpath: restParts.length ? `/${restParts.join("/")}` : "" };
  }
  // bare CID, optional /path in same string not supported — use ipfs://CID/path
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-z2-7]+)/i.test(t.split("/")[0]!)) {
    const parts = t.split("/").filter(Boolean);
    const cid = parts[0]!;
    const rest = parts.slice(1);
    return { cid, subpath: rest.length ? `/${rest.join("/")}` : "" };
  }
  throw new Error(`Could not parse IPFS target: ${raw}`);
}

function pinataToken(): string | null {
  const s =
    process.env.PINATA_GATEWAY_ACCESS_TOKEN?.trim() ||
    process.env.PINATA_GATEWAY_KEY?.trim() ||
    process.env.PINATA_GATEWAY_TOKEN?.trim();
  return s || null;
}

const CONFIGURED_HOSTS = new Set<string>();
for (const k of [
  "NEXT_PUBLIC_PINATA_GATEWAY_URL",
  "PINATA_GATEWAY_URL",
  "NEXT_PUBLIC_IPFS_GATEWAY_URL",
  "IPFS_GATEWAY_URL",
] as const) {
  const b = normalizeBase(process.env[k]);
  if (b)
    try {
      CONFIGURED_HOSTS.add(new URL(b).host);
    } catch {
      /* ignore */
    }
}

function gatewayBases(): string[] {
  const seen = new Set<string>();
  const add = (u: string | null) => {
    if (!u) return;
    if (seen.has(u)) return;
    seen.add(u);
  };
  add(normalizeBase(process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL));
  add(normalizeBase(process.env.PINATA_GATEWAY_URL));
  add(normalizeBase(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL));
  add(normalizeBase(process.env.IPFS_GATEWAY_URL));
  // Public fallbacks (same spirit as app code / common gateways)
  add("https://ipfs.io");
  add("https://cloudflare-ipfs.com");
  add("https://dweb.link");
  return [...seen];
}

function buildUrl(base: string, cid: string, subpath: string): string {
  const path = `/ipfs/${cid}${subpath}`;
  const u = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const token = pinataToken();
  try {
    if (token && CONFIGURED_HOSTS.has(new URL(base).host)) {
      u.searchParams.set("pinataGatewayToken", token);
    }
  } catch {
    /* ignore */
  }
  return u.toString();
}

async function timeGet(
  url: string,
  timeoutMs: number
): Promise<{ ms: number; status: number; ok: boolean; bytes: number; err?: string }> {
  const t0 = performance.now();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = { signal: controller.signal, redirect: "follow" };
    const token = pinataToken();
    try {
      if (token && new URL(url).host && CONFIGURED_HOSTS.has(new URL(url).host)) {
        init.headers = { "x-pinata-gateway-token": token };
      }
    } catch {
      /* ignore */
    }
    const res = await fetch(url, init);
    const buf = await res.arrayBuffer();
    const ms = Math.round(performance.now() - t0);
    return { ms, status: res.status, ok: res.ok, bytes: buf.byteLength };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    return { ms, status: 0, ok: false, bytes: 0, err: msg };
  } finally {
    clearTimeout(tid);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let timeoutMs = 120_000;
  const pos: string[] = [];
  for (const a of argv) {
    if (a.startsWith("--timeout=")) {
      timeoutMs = Number(a.slice("--timeout=".length)) || timeoutMs;
    } else if (a === "-h" || a === "--help") {
      console.log(`
ipfs-gateway-benchmark.ts <ipfs-url-or-https-gateway-url> [--timeout=ms]

Examples:
  tsx scripts/ipfs-gateway-benchmark.ts "ipfs://bafybei.../metadata.json"
  tsx scripts/ipfs-gateway-benchmark.ts "https://gateway.pinata.cloud/ipfs/QmXoy.../wiki"

Env (optional): NEXT_PUBLIC_PINATA_GATEWAY_URL, PINATA_GATEWAY_URL,
NEXT_PUBLIC_IPFS_GATEWAY_URL, IPFS_GATEWAY_URL, PINATA_GATEWAY_ACCESS_TOKEN
`);
      process.exit(0);
    } else {
      pos.push(a);
    }
  }

  const target = pos[0];
  if (!target) {
    // Default: tiny well-known IPFS object (project docs tree) — good sanity check
    const demo = "ipfs://QmYwAPJzv5CZsnA6258spSq3CkgNg2aKhDyqWjTHcwVpjz/readme";
    console.log(`No argument — using demo CID (IPFS docs readme):\n  ${demo}\n`);
    const { cid, subpath } = parseTarget(demo);
    await runFor(cid, subpath, timeoutMs);
    process.exit(0);
  }

  const { cid, subpath } = parseTarget(target);
  await runFor(cid, subpath, timeoutMs);
}

async function runFor(cid: string, subpath: string, timeoutMs: number) {
  console.log(`CID: ${cid}${subpath || ""}`);
  console.log(`Timeout per gateway: ${timeoutMs}ms\n`);

  const bases = gatewayBases();
  if (bases.length === 0) {
    console.error("No gateway bases — check env.");
    process.exit(1);
  }

  console.log("Gateways:", bases.join("\n          "), "\n");

  const rows: string[] = [];
  for (const base of bases) {
    const url = buildUrl(base, cid, subpath);
    process.stdout.write(`${base.padEnd(42)} … `);
    const r = await timeGet(url, timeoutMs);
    if (r.err) {
      console.log(`FAIL ${r.ms}ms  ${r.err}`);
      rows.push(`${base}\t${r.ms}\t0\t0\t${r.err}`);
    } else {
      const tag = r.ok ? "OK" : `HTTP_${r.status}`;
      console.log(`${tag}  ${r.ms}ms  ${r.bytes} bytes`);
      rows.push(`${base}\t${r.ms}\t${r.status}\t${r.bytes}\t${r.ok ? "" : "not ok"}`);
    }
  }

  console.log("\n--- TSV ---");
  console.log("gateway\tms\thttpStatus\tbytes\tnote");
  for (const line of rows) console.log(line);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
