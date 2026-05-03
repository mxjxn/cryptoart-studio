import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { browseListings } from "~/lib/server/browse-listings";
import MarketClient, { type MarketInitialPayload } from "./MarketClient";

export const metadata: Metadata = {
  title: `Market | ${APP_NAME}`,
  description: "Browse all listings on cryptoart.social",
};

/** Subgraph-only payload; no per-request IPFS/metadata. Ok to be hours stale. */
export const revalidate = 86_400;

async function getInitialPayload(tab: "all" | "recent"): Promise<MarketInitialPayload> {
  const orderBy = tab === "recent" ? "createdAt" : "listingId";
  const result = await browseListings({
    first: 20,
    skip: 0,
    orderBy,
    orderDirection: "desc",
    enrich: false,
  });
  return {
    tab,
    listings: result.listings,
    hasMore: result.listings.length === 20 && result.subgraphReturnedFullCount,
    subgraphDown: result.subgraphDown ?? false,
    degraded: false,
  };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "recent" ? "recent" : "all";
  const initial = await getInitialPayload(tab);

  return <MarketClient key={tab} initial={initial} />;
}
