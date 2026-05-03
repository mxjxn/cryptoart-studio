import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { browseListings } from "~/lib/server/browse-listings";
import type { MarketLifecycleTab } from "~/lib/market-lifecycle";
import MarketClient, { type MarketInitialPayload } from "./MarketClient";

export const metadata: Metadata = {
  title: `Market | ${APP_NAME}`,
  description: "Browse all listings on cryptoart.social",
};

/**
 * ISR window for **auction** slice (bids, reserve, times) from the subgraph.
 * **Artwork** (title, image, artist) is cached per token for 7d via `fetchNFTMetadataCached`
 * in browse — cold IPFS once, then cheap on each regen.
 */
export const revalidate = 300;

function parseMarketTab(raw: string | undefined): MarketLifecycleTab {
  if (raw === "upcoming" || raw === "finished") return raw;
  return "active";
}

async function getInitialPayload(tab: MarketLifecycleTab): Promise<MarketInitialPayload> {
  const orderBy = tab === "finished" ? "updatedAt" : "listingId";
  const result = await browseListings({
    first: 20,
    skip: 0,
    orderBy,
    orderDirection: "desc",
    enrich: true,
    marketLifecycle: tab,
  });
  return {
    tab,
    listings: result.listings,
    hasMore: result.listings.length === 20 && result.subgraphReturnedFullCount,
    subgraphDown: result.subgraphDown ?? false,
    degraded: false,
    ssrEnriched: true,
  };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseMarketTab(sp.tab);
  const initial = await getInitialPayload(tab);

  return <MarketClient key={tab} initial={initial} />;
}
