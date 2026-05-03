"use client";

import { AuctionCard } from "~/components/AuctionCard";
import type { EnrichedAuctionData } from "~/lib/types";
import { GRADIENT_CSS_PRESETS } from "~/lib/listing-theme";

interface FeaturedSectionGridProps {
  title: string;
  description?: string | null;
  listings: EnrichedAuctionData[];
}

export function FeaturedSectionGrid({
  title,
  description,
  listings,
}: FeaturedSectionGridProps) {
  return (
    <section className="border-b border-[#333333]">
      <div className="px-5 py-6">
        <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] mb-2 font-mek-mono">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[#cccccc] mb-4">{description}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {listings.map((auction, index) => (
            <AuctionCard
              key={auction.listingId}
              auction={auction}
              gradient={GRADIENT_CSS_PRESETS[index % GRADIENT_CSS_PRESETS.length]!}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

