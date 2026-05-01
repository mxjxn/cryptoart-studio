import { headers } from "next/headers";
import { APP_URL } from "~/lib/constants";

/**
 * Public origin for the current request (embeds, OG metadata, opengraph font fetch).
 * Prefer forwarded headers so local `localhost:3000` is not replaced by `NEXT_PUBLIC_URL`
 * (e.g. ngrok) which would make the browser or Next hit a slow/offline tunnel and feel "stuck".
 */
export async function getRequestSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return APP_URL;

    const rawProto = h.get("x-forwarded-proto");
    const proto =
      rawProto?.split(",")[0]?.trim() ??
      (host.startsWith("localhost") ||
      host.startsWith("127.") ||
      host.endsWith(".local")
        ? "http"
        : "https");

    return `${proto}://${host}`;
  } catch {
    return APP_URL;
  }
}
