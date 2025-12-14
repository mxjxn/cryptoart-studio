"use client";

import { useEffect, useState } from "react";
import { FeaturedSectionCarousel } from "~/components/FeaturedSectionCarousel";
import { FeaturedSectionGrid } from "~/components/FeaturedSectionGrid";
import { SingleListingSection } from "~/components/sections/SingleListingSection";
import { FeaturedArtistSection } from "~/components/sections/FeaturedArtistSection";
import { RecentListingsSection } from "~/components/sections/RecentListingsSection";
import type { EnrichedAuctionData } from "~/lib/types";

type SectionType =
  | "upcoming_auctions"
  | "recently_concluded"
  | "live_bids"
  | "artist"
  | "gallery"
  | "collector"
  | "listing"
  | "custom_section"
  | "recent_listings";

interface HomepageSection {
  id: string;
  sectionType: SectionType;
  title?: string | null;
  description?: string | null;
  config?: Record<string, any> | null;
  listings: EnrichedAuctionData[];
}

export function HomepageLayout() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/homepage-layout");
        if (!res.ok) throw new Error("Failed to load homepage layout");
        const data = await res.json();
        setSections(data.sections || []);
      } catch (error) {
        console.error("[HomepageLayout] failed to fetch layout", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Show loading state instead of returning null
  if (loading) {
    return (
      <div className="px-5 py-8">
        <div className="text-center text-[#999999] text-sm">Loading sections...</div>
      </div>
    );
  }

  // Show message if no sections configured, but don't hide the component
  if (sections.length === 0) {
    return null; // Return null only if truly no sections (admin hasn't configured any)
  }

  return (
    <>
      {sections.map((section) => {
        // Featured Artist Section - special full-width layout
        if (section.sectionType === "artist" && section.listings.length > 0) {
          return (
            <FeaturedArtistSection
              key={section.id}
              title={section.title}
              description={section.description}
              listing={section.listings[0]}
            />
          );
        }

        // Single Listing Section
        if (section.sectionType === "listing" && section.listings.length > 0) {
          return (
            <SingleListingSection
              key={section.id}
              title={section.title}
              description={section.description}
              listing={section.listings[0]}
            />
          );
        }

        // Recent Listings Section
        if (section.sectionType === "recent_listings") {
          return (
            <RecentListingsSection
              key={section.id}
              title={section.title || getDefaultTitle(section.sectionType)}
              description={section.description}
              listings={section.listings}
            />
          );
        }

        // Show sections even if they have no listings (with empty state message)
        if (section.listings.length === 0) {
          return (
            <div key={section.id} className="px-5 py-8">
              <h2 className="text-xl font-light mb-2">
                {section.title || getDefaultTitle(section.sectionType)}
              </h2>
              {section.description && (
                <p className="text-sm text-[#999999] mb-4">{section.description}</p>
              )}
              <div className="text-center py-8 text-[#666666] text-sm">
                No listings available in this section yet.
              </div>
            </div>
          );
        }

        const displayFormat = section.config?.displayFormat || "carousel";
        if (displayFormat === "grid") {
          return (
            <FeaturedSectionGrid
              key={section.id}
              title={section.title || getDefaultTitle(section.sectionType)}
              description={section.description}
              listings={section.listings}
            />
          );
        }

        return (
          <FeaturedSectionCarousel
            key={section.id}
            title={section.title || getDefaultTitle(section.sectionType)}
            description={section.description}
            listings={section.listings}
          />
        );
      })}
    </>
  );
}

function getDefaultTitle(sectionType: SectionType) {
  switch (sectionType) {
    case "upcoming_auctions":
      return "Upcoming Auctions";
    case "recently_concluded":
      return "Recently Concluded";
    case "live_bids":
      return "Live Bids";
    case "artist":
      return "Artist Picks";
    case "gallery":
      return "Gallery";
    case "collector":
      return "Collector Highlights";
    case "recent_listings":
      return "Recent Listings";
    case "custom_section":
      return "Featured";
    default:
      return "Featured";
  }
}

