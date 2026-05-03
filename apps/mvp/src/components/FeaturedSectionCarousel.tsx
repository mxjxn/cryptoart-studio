"use client";

import { AuctionCard } from "~/components/AuctionCard";
import type { EnrichedAuctionData } from "~/lib/types";
import { GRADIENT_CSS_PRESETS } from "~/lib/listing-theme";

interface FeaturedSectionCarouselProps {
  title: string;
  description?: string | null;
  listings: EnrichedAuctionData[];
}

export function FeaturedSectionCarousel({
  title,
  description,
  listings,
}: FeaturedSectionCarouselProps) {
  return (
    <section className="border-b border-[#333333]">
      <div className="px-5 py-6">
        <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] mb-2 font-mek-mono">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[#cccccc] mb-4">{description}</p>
        )}
        <div className="flex overflow-x-auto gap-4 pb-2 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide">
          {listings.map((auction, index) => (
            <div
              key={auction.listingId}
              className="flex-shrink-0 w-[280px] snap-start"
            >
              <AuctionCard
                auction={auction}
                gradient={GRADIENT_CSS_PRESETS[index % GRADIENT_CSS_PRESETS.length]!}
                index={index}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

