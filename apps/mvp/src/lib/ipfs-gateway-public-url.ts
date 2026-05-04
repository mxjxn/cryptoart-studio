/**
 * Rewrite IPFS HTTP(S) and ipfs:// URLs to the app-configured gateway for **browser** requests
 * (<img src>, etc.). Public gateways like ipfs.io often rate-limit or fail on large assets;
 * dedicated gateways (Pinata, etc.) are set via NEXT_PUBLIC_* / server env.
 *
 * Mirrors the gateway preference order in `nft-metadata.ts` (without importing that module
 * into client bundles).
 */

function trimGatewayBase(url: string | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

/**
 * Only `NEXT_PUBLIC_*` so SSR and browser bundles agree (no hydration mismatch).
 * Set `NEXT_PUBLIC_PINATA_GATEWAY_URL` or `NEXT_PUBLIC_IPFS_GATEWAY_URL` in production
 * so listing `<img>` requests use your gateway instead of hard-coded ipfs.io links from metadata.
 */
function preferredGatewayBase(): string | null {
  return (
    trimGatewayBase(process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL) ||
    trimGatewayBase(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL) ||
    null
  );
}

/** Optional browser-safe Pinata dedicated-gateway token (query param). */
function pinataGatewayTokenForClient(): string | null {
  if (typeof window === "undefined") return null;
  const t = process.env.NEXT_PUBLIC_PINATA_GATEWAY_TOKEN?.trim();
  return t || null;
}

function appendPinataTokenIfApplicable(url: string, gatewayBase: string): string {
  const token = pinataGatewayTokenForClient();
  if (!token) return url;
  try {
    const baseHost = new URL(gatewayBase.startsWith("http") ? gatewayBase : `https://${gatewayBase}`).host;
    const u = new URL(url);
    if (u.host !== baseHost) return url;
    if (!u.searchParams.has("pinataGatewayToken")) {
      u.searchParams.set("pinataGatewayToken", token);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * If a gateway base is configured, rewrite `ipfs://…` and `https://…/ipfs/…` URLs to it so
 * the browser does not depend on ipfs.io. No-op when unset or when URL is not IPFS-shaped.
 */
export function rewritePublicIpfsUrlForClient(url: string): string {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const gateway = preferredGatewayBase();
  if (!gateway) return url;

  let out = url;

  if (url.startsWith("ipfs://")) {
    const rest = url.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
    if (!rest) return url;
    out = `${gateway}/ipfs/${rest}`;
    return appendPinataTokenIfApplicable(out, gateway);
  }

  if (/^https?:\/\//i.test(url) && url.includes("/ipfs/")) {
    const slashIdx = url.indexOf("/ipfs/");
    const rest = url.slice(slashIdx + "/ipfs/".length);
    if (!rest) return url;
    out = `${gateway}/ipfs/${rest}`;
    return appendPinataTokenIfApplicable(out, gateway);
  }

  return url;
}
