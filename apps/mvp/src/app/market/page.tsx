import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMarketInitialPayload } from "~/lib/server/market-page-data";
import type { MarketBrowseMode } from "~/lib/market-visibility";
import MarketClient from "./MarketClient";

export const metadata: Metadata = {
  title: `Market | ${APP_NAME}`,
  description: "Browse all listings on cryptoart.social",
};

/** Cached grid + snapshot rails; searchParams still make the route dynamic. */
export const revalidate = 60;

function parseMarketBrowseMode(raw: string | undefined): MarketBrowseMode {
  if (raw === "include-ended" || raw === "finished") return "include-ended";
  return "live";
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const marketMode = parseMarketBrowseMode(sp.mode ?? sp.tab);
  const initial = await getMarketInitialPayload(marketMode);

  return <MarketClient key={marketMode} initial={initial} />;
}
