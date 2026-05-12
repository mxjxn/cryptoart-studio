import type { NextRequest } from "next/server";

/**
 * Origin for same-process fetches (fonts, logo, static assets) from OG routes.
 * Must match the actual listener protocol — `request.url` can be `https://localhost:…`
 * while `next dev` is HTTP-only, which causes `fetch` → ERR_SSL_WRONG_VERSION_NUMBER.
 *
 * Prefer forwarded headers; force `http` for local hosts when clients send misleading
 * `https` / `x-forwarded-proto` (embed preview tools, misconfigured proxies).
 */
export function getOgSelfOrigin(request: NextRequest): string {
  const fromUrl = new URL(request.url);
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host =
    forwardedHost || request.headers.get("host") || fromUrl.host;

  const rawProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  const hostname = host.split(":")[0] ?? host;
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("127.");

  let proto =
    rawProto && rawProto.length > 0
      ? rawProto
      : isLocal
        ? "http"
        : "https";

  if (isLocal && proto === "https") {
    proto = "http";
  }

  return `${proto}://${host}`;
}
