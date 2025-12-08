"use client";

import { AuctionCard } from "~/components/AuctionCard";
import type { EnrichedAuctionData } from "~/lib/types";

// Gradient colors for artwork placeholders
const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

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
              gradient={gradients[index % gradients.length]}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

