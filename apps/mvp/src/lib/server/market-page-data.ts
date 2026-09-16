import { unstable_cache } from "next/cache";
import { browseListings } from "~/lib/server/browse-listings";
import { readMarketLayoutSnapshot } from "~/lib/server/market-layout-snapshot";
import { splitMarketHero } from "~/lib/market-layout";
import { withTimeout } from "~/lib/utils";
import {
  filterListingsForMarketMode,
  filterMarketSections,
  isVisibleOnMarket,
  type MarketBrowseMode,
} from "~/lib/market-visibility";
import type { BrowseListingsResult } from "~/lib/server/browse-listings";
import type { MarketInitialPayload } from "~/lib/market-page-types";

const MARKET_GRID_SIZE = 20;
/** Hard ceiling so a cold subgraph cannot hold the document open. */
const MARKET_SSR_GRID_TIMEOUT_MS = 4_000;
const MARKET_SSR_SNAPSHOT_TIMEOUT_MS = 1_500;

const EMPTY_BROWSE: BrowseListingsResult = {
  listings: [],
  subgraphReturnedFullCount: false,
  subgraphDown: false,
};

const getCachedMarketGrid = unstable_cache(
  async (marketMode: MarketBrowseMode) =>
    browseListings({
      first: MARKET_GRID_SIZE,
      skip: 0,
      orderBy: "listingId",
      orderDirection: "desc",
      enrich: false,
      marketBrowseMode: marketMode,
    }),
  ["market-grid-light-v1"],
  {
    revalidate: 60,
    tags: ["market-browse"],
  }
);

export async function getMarketInitialPayload(
  marketMode: MarketBrowseMode
): Promise<MarketInitialPayload> {
  try {
    const [browseTimed, sections] = await Promise.all([
      withTimeout(
        getCachedMarketGrid(marketMode).then(
          (result): { timedOut: boolean; result: BrowseListingsResult } => ({
            timedOut: false,
            result,
          })
        ),
        MARKET_SSR_GRID_TIMEOUT_MS,
        { timedOut: true, result: EMPTY_BROWSE }
      ),
      withTimeout(readMarketLayoutSnapshot(), MARKET_SSR_SNAPSHOT_TIMEOUT_MS, []),
    ]);

    const browseResult = browseTimed.result;
    const { hero, sections: restSections } = splitMarketHero(sections);
    const listings = filterListingsForMarketMode(browseResult.listings, marketMode);
    const visibleHero =
      hero && isVisibleOnMarket(hero as unknown as Record<string, unknown>, marketMode)
        ? hero
        : null;
    const visibleSections = filterMarketSections(restSections, marketMode);

    return {
      marketMode,
      listings,
      hasMore: listings.length === MARKET_GRID_SIZE && browseResult.subgraphReturnedFullCount,
      subgraphDown: browseResult.subgraphDown ?? false,
      degraded: browseTimed.timedOut,
      ssrEnriched: !browseTimed.timedOut,
      hero: visibleHero,
      sections: visibleSections,
    };
  } catch (error) {
    console.error("[Market] SSR payload failed", error);
    return {
      marketMode,
      listings: [],
      hasMore: false,
      subgraphDown: true,
      degraded: true,
      ssrEnriched: false,
      hero: null,
      sections: [],
    };
  }
}
