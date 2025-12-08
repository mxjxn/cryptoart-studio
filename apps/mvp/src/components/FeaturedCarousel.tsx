"use client";

import { useEffect, useState } from "react";
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

export function FeaturedCarousel() {
  const [featuredListings, setFeaturedListings] = useState<EnrichedAuctionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await fetch("/api/featured");
        if (!response.ok) {
          throw new Error("Failed to fetch featured listings");
        }
        const data = await response.json();
        setFeaturedListings(data.listings || []);
      } catch (error) {
        console.error("Error fetching featured listings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (featuredListings.length === 0) {
    return null; // Don't show carousel if no featured listings
  }

  return (
    <section className="border-b border-[#333333]">
      <div className="px-5 py-6">
        <h2 className="text-[13px] uppercase tracking-[2px] text-[#999999] mb-4 font-mek-mono">
          Featured
        </h2>
        <div className="flex overflow-x-auto gap-4 pb-2 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide">
          {featuredListings.map((auction, index) => (
            <div
              key={auction.listingId}
              className="flex-shrink-0 w-[280px] snap-start"
            >
              <AuctionCard
                auction={auction}
                gradient={gradients[index % gradients.length]}
                index={index}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

