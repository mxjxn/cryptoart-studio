"use client";

import Image from "next/image";
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

export function StaticArtworkTile({
  auction,
  gradient,
}: {
  auction: EnrichedAuctionData;
  gradient: string;
}) {
  const artUrl = listingArtworkUrl(auction);
  return (
    <div className="min-h-[160px] border border-black/15 bg-black p-2 text-white">
      <TransitionLink
        href={canonicalListingDetailPath(
          auction.chainId ?? BASE_CHAIN_ID,
          auction.listingId,
        )}
        prefetch={false}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <div className="relative flex min-h-[140px] flex-col justify-between overflow-hidden p-2">
          {artUrl ? (
            <>
              <Image
                src={artUrl}
                alt={listingTileDisplayTitle(auction)}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 45vw, 200px"
                unoptimized
              />
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/25 to-black/10"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 z-[1] opacity-50 mix-blend-soft-light"
                style={{ background: gradient }}
                aria-hidden
              />
            </>
          ) : (
            <div className="absolute inset-0 z-0" style={{ background: gradient }} aria-hidden />
          )}
          <div className="relative z-10 bg-black/70 p-2 font-space-grotesk text-xs">
            <p className="truncate text-white">{listingTileDisplayTitle(auction)}</p>
            <p className="truncate text-white/75">{listingTileDisplayArtist(auction)}</p>
            <p className="text-white/70">{formatStaticEth(auction.currentPrice || auction.initialAmount)}</p>
          </div>
        </div>
      </TransitionLink>
    </div>
  );
}
