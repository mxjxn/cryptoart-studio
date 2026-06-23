import type { HomepageSection } from "~/lib/server/homepage-layout";
import type { EnrichedAuctionData } from "~/lib/types";

export type MarketLayoutPayload = {
  hero: EnrichedAuctionData | null;
  sections: HomepageSection[];
};

/**
 * Pick an optional hero listing from admin-configured market sections.
 * Priority: dedicated `listing` section (single lot), then first lot of `featured_carousel`.
 */
export function splitMarketHero(sections: HomepageSection[]): MarketLayoutPayload {
  const rest = [...sections];
  let hero: EnrichedAuctionData | null = null;

  const listingIdx = rest.findIndex(
    (s) => s.sectionType === "listing" && (s.listings?.length ?? 0) >= 1
  );
  if (listingIdx >= 0) {
    hero = rest[listingIdx]!.listings[0]!;
    rest.splice(listingIdx, 1);
    return { hero, sections: rest };
  }

  const carouselIdx = rest.findIndex(
    (s) => s.sectionType === "featured_carousel" && (s.listings?.length ?? 0) > 0
  );
  if (carouselIdx >= 0) {
    const sec = rest[carouselIdx]!;
    hero = sec.listings[0]!;
    const remaining = sec.listings.slice(1);
    if (remaining.length === 0) {
      rest.splice(carouselIdx, 1);
    } else {
      rest[carouselIdx] = { ...sec, listings: remaining };
    }
    return { hero, sections: rest };
  }

  return { hero: null, sections: rest };
}
