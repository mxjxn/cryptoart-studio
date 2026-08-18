import { NextRequest } from "next/server";
import { GET as listingOpengraphGET } from "../../../[listingId]/opengraph-image/route";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";

/**
 * OG image for `/listing/base/:id` — delegates to the main listing OG route with
 * `chainId=8453` so the listing resolves explicitly on Base.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await context.params;
  const u = new URL(request.url);
  u.pathname = `/listing/${listingId}/opengraph-image`;
  u.searchParams.set("chainId", String(BASE_CHAIN_ID));
  const proxied = new NextRequest(u.toString(), { headers: request.headers });
  return listingOpengraphGET(proxied, {
    params: Promise.resolve({ listingId }),
  });
}
