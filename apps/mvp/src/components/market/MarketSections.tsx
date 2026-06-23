"use client";

import { AuctionCard } from "~/components/AuctionCard";
import type { HomepageSection } from "~/lib/server/homepage-layout";

const gradients = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
];

function sectionHeading(section: HomepageSection): string {
  if (section.title?.trim()) return section.title.trim();
  return String(section.sectionType).replace(/_/g, " ");
}

export function MarketSections({ sections }: { sections: HomepageSection[] }) {
  if (!sections.length) return null;

  return (
    <div className="mb-10 space-y-10">
      {sections.map((section, si) => {
        const listings = section.listings ?? [];
        if (listings.length === 0) return null;

        return (
          <section key={section.id} className="border-b border-[#333333] pb-8 last:border-b-0">
            <h2 className="mb-1 font-mek-mono text-sm uppercase tracking-[0.5px] text-white">
              {sectionHeading(section)}
            </h2>
            {section.description ? (
              <p className="mb-4 text-xs text-[#999999]">{section.description}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {listings.map((auction, i) => (
                <AuctionCard
                  key={`${section.id}-${String(auction.listingId)}-${String(auction.chainId ?? "")}`}
                  auction={auction}
                  gradient={gradients[(si + i) % gradients.length]}
                  index={i}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
