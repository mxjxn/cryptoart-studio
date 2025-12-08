"use client";

import { useEffect, useState } from "react";
import { FeaturedSectionCarousel } from "~/components/FeaturedSectionCarousel";
import { FeaturedSectionGrid } from "~/components/FeaturedSectionGrid";
import type { EnrichedAuctionData } from "~/lib/types";

interface FeaturedSection {
  id: string;
  type: 'featured_artists' | 'recently_sold' | 'upcoming' | 'collection' | 'custom';
  title: string;
  description?: string | null;
  config?: Record<string, any> | null;
  displayOrder: number;
  isActive: boolean;
  listings: EnrichedAuctionData[];
}

export function FeaturedSections() {
  const [sections, setSections] = useState<FeaturedSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await fetch("/api/featured-sections");
        if (!response.ok) {
          throw new Error("Failed to fetch featured sections");
        }
        const data = await response.json();
        setSections(data.sections || []);
      } catch (error) {
        console.error("Error fetching featured sections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (sections.length === 0) {
    return null; // Don't show anything if no sections
  }

  return (
    <>
      {sections.map((section) => {
        if (section.listings.length === 0) {
          return null; // Don't render empty sections
        }

        // Determine display format based on section type or config
        const displayFormat = section.config?.displayFormat || 'carousel';

        if (displayFormat === 'grid') {
          return (
            <FeaturedSectionGrid
              key={section.id}
              title={section.title}
              description={section.description}
              listings={section.listings}
            />
          );
        } else {
          // Default to carousel
          return (
            <FeaturedSectionCarousel
              key={section.id}
              title={section.title}
              description={section.description}
              listings={section.listings}
            />
          );
        }
      })}
    </>
  );
}

