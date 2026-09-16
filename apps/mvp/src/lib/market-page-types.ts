import type { EnrichedAuctionData } from "~/lib/types";
import type { HomepageSection } from "~/lib/server/homepage-layout";
import type { MarketBrowseMode } from "~/lib/market-visibility";

export type MarketInitialPayload = {
  marketMode: MarketBrowseMode;
  listings: EnrichedAuctionData[];
  hasMore: boolean;
  subgraphDown: boolean;
  degraded: boolean;
  ssrEnriched: boolean;
  hero: EnrichedAuctionData | null;
  sections: HomepageSection[];
};
