"use client";

import type { EnrichedAuctionData } from "~/lib/types";
import { canonicalListingDetailPath } from "~/lib/listing-chain-paths";
import { BASE_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { TransitionLink } from "~/components/TransitionLink";
import {
  listingArtworkUrl,
  listingTileDisplayTitle,
  listingTileDisplayArtist,
  formatStaticEth,
} from "~/lib/homepage-static-data";

export function MainnetFirstListingArtCard({
  auction,
  gradient,
}: {
  auction: EnrichedAuctionData;
  gradient: string;
}) {
  const artUrl = listingArtworkUrl(auction);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-black/25 bg-neutral-950 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
      <TransitionLink
        href={canonicalListingDetailPath(
          auction.chainId ?? BASE_CHAIN_ID,
          auction.listingId,
        )}
        prefetch={false}
        className="flex h-full min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-black/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#dcf54c]"
      >
        <div className="flex min-h-[33vh] w-full shrink-0 flex-col items-center justify-center bg-[#0a0a0a] px-3 py-4 sm:min-h-[min(40vh,640px)] sm:px-5 sm:py-6 lg:min-h-[320px] lg:flex-1 lg:basis-0">
          {artUrl ? (
            <img
              src={artUrl}
              alt={listingTileDisplayTitle(auction)}
              className="h-auto max-h-[30vh] w-full max-w-full object-contain object-center sm:max-h-[min(36vh,600px)] lg:max-h-[min(56vh,720px)]"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: gradient }}
              aria-hidden
            />
          )}
        </div>
        <div className="shrink-0 border-t border-white/10 bg-black px-4 py-3 sm:px-5 sm:py-4">
          <p className="font-space-grotesk text-sm font-medium leading-snug text-white sm:text-base">
            {listingTileDisplayTitle(auction)}
          </p>
          <p className="mt-1 font-space-grotesk text-xs leading-snug text-white/75 sm:text-sm">
            {listingTileDisplayArtist(auction)}
          </p>
          <p className="mt-2 font-mek-mono text-xs tabular-nums text-white/90 sm:text-sm">
            {formatStaticEth(auction.currentPrice || auction.initialAmount)}
          </p>
        </div>
      </TransitionLink>
    </div>
  );
}
