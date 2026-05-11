import { NextRequest } from "next/server";
import { GET as listingOpengraphGET } from "../../../[listingId]/opengraph-image/route";

/**
 * OG image for `/listing/eth/:id` — delegates to the main listing OG route with `chainId=1`
 * so `getAuctionServer` and token metadata resolve on Ethereum mainnet.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await context.params;
  const u = new URL(request.url);
  u.pathname = `/listing/${listingId}/opengraph-image`;
  u.searchParams.set("chainId", "1");
  const proxied = new NextRequest(u.toString(), { headers: request.headers });
  return listingOpengraphGET(proxied, {
    params: Promise.resolve({ listingId }),
  });
}
