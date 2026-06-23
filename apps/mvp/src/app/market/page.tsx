import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { browseListings } from "~/lib/server/browse-listings";
import { resolveMarketSections } from "~/lib/server/homepage-layout";
import { splitMarketHero } from "~/lib/market-layout";
import type { MarketBrowseMode } from "~/lib/market-visibility";
import MarketClient, { type MarketInitialPayload } from "./MarketClient";

export const metadata: Metadata = {
  title: `Market | ${APP_NAME}`,
  description: "Browse all listings on cryptoart.social",
};

/** ISR window for auction slice from subgraph; artwork cached longer via metadata cache. */
export const revalidate = 120;

function parseMarketBrowseMode(raw: string | undefined): MarketBrowseMode {
  if (raw === "include-ended" || raw === "finished") return "include-ended";
  return "live";
}

async function getInitialPayload(marketMode: MarketBrowseMode): Promise<MarketInitialPayload> {
  const [browseResult, sectionsResolved] = await Promise.all([
    browseListings({
      first: 20,
      skip: 0,
      orderBy: "listingId",
      orderDirection: "desc",
      enrich: true,
      marketBrowseMode: marketMode,
    }),
    resolveMarketSections(false),
  ]);

  const { hero, sections } = splitMarketHero(sectionsResolved);

  return {
    marketMode,
    listings: browseResult.listings,
    hasMore: browseResult.listings.length === 20 && browseResult.subgraphReturnedFullCount,
    subgraphDown: browseResult.subgraphDown ?? false,
    degraded: false,
    ssrEnriched: true,
    hero,
    sections,
  };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const marketMode = parseMarketBrowseMode(sp.mode ?? sp.tab);
  const initial = await getInitialPayload(marketMode);

  return <MarketClient key={marketMode} initial={initial} />;
}
