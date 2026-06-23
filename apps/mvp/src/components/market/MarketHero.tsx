"use client";

import type { EnrichedAuctionData } from "~/lib/types";
import { canonicalListingDetailPath } from "~/lib/listing-chain-paths";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { TransitionLink } from "~/components/TransitionLink";
import {
  listingArtworkUrl,
  listingTileDisplayArtist,
  listingTileDisplayTitle,
  formatStaticEth,
} from "~/lib/homepage-static-data";
import { getMarketListingKind } from "~/lib/market-visibility";

function heroStatusLabel(auction: EnrichedAuctionData): string {
  const kind = getMarketListingKind(auction as Record<string, unknown>);
  switch (kind) {
    case "awaiting-bid":
      return "Awaiting first bid";
    case "scheduled":
      return "Scheduled";
    case "open-sale":
      return "Buy now";
    case "live":
      return "Live now";
    default:
      return "Featured";
  }
}

export function MarketHero({ auction }: { auction: EnrichedAuctionData }) {
  const artUrl = listingArtworkUrl(auction);
  const chainId =
    typeof auction.chainId === "number" && Number.isFinite(auction.chainId)
      ? auction.chainId
      : BASE_CHAIN_ID;
  const href = canonicalListingDetailPath(chainId, String(auction.listingId));
  const price =
    auction.highestBid?.amount || auction.currentPrice || auction.initialAmount;

  return (
    <section className="mb-10 overflow-hidden rounded-lg border border-[#333333] bg-[#0a0a0a]">
      <TransitionLink
        href={href}
        prefetch={false}
        className="group grid grid-cols-1 outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="relative flex min-h-[280px] items-center justify-center bg-[#111111] p-6 md:min-h-[360px]">
          {artUrl ? (
            <img
              src={artUrl}
              alt={listingTileDisplayTitle(auction)}
              className="max-h-[320px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#667eea] to-[#764ba2]" aria-hidden />
          )}
        </div>
        <div className="flex flex-col justify-center border-t border-[#333333] p-6 md:border-l md:border-t-0 md:p-8">
          <p className="mb-3 font-mek-mono text-xs uppercase tracking-[0.12em] text-[#999999]">
            Featured · {heroStatusLabel(auction)}
          </p>
          <h2 className="font-space-grotesk text-2xl font-medium leading-tight text-white md:text-3xl">
            {listingTileDisplayTitle(auction)}
          </h2>
          <p className="mt-2 text-sm text-[#cccccc]">{listingTileDisplayArtist(auction)}</p>
          <p className="mt-4 font-mek-mono text-sm tabular-nums text-white">
            {formatStaticEth(price)}
          </p>
          <span className="mt-6 inline-flex w-fit items-center text-sm font-medium text-white underline-offset-4 group-hover:underline">
            View listing →
          </span>
        </div>
      </TransitionLink>
    </section>
  );
}
