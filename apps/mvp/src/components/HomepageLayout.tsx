"use client";

import { useEffect, useState } from "react";
import { FeaturedSectionCarousel } from "~/components/FeaturedSectionCarousel";
import { FeaturedSectionGrid } from "~/components/FeaturedSectionGrid";
import { SingleListingSection } from "~/components/sections/SingleListingSection";
import type { EnrichedAuctionData } from "~/lib/types";

type SectionType =
  | "upcoming_auctions"
  | "recently_concluded"
  | "live_bids"
  | "artist"
  | "gallery"
  | "collector"
  | "listing"
  | "custom_section";

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

  if (loading || sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => {
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

        if (section.listings.length === 0) {
          return null;
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
    case "custom_section":
      return "Featured";
    default:
      return "Featured";
  }
}

