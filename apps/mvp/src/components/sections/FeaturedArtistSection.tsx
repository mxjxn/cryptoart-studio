"use client";

import Image from "next/image";
import { TransitionLink } from "~/components/TransitionLink";
import type { EnrichedAuctionData } from "~/lib/types";

interface FeaturedArtistSectionProps {
  title?: string | null;
  description?: string | null;
  listing: EnrichedAuctionData;
}

export function FeaturedArtistSection({
  title,
  description,
  listing,
}: FeaturedArtistSectionProps) {
  // Get the first listing's image - prefer thumbnail, fallback to metadata image
  const imageUrl =
    listing.thumbnailUrl ||
    listing.metadata?.image ||
    listing.image ||
    "/placeholder-image.png";

  // Get artist name
  const artistName = listing.artist || listing.seller || "Unknown Artist";

  // Get listing title
  const listingTitle = listing.metadata?.name || listing.title || "Untitled";

  return (
    <section className="border-b border-[#333333] h-[50vh] relative overflow-hidden w-full">
      <TransitionLink
        href={`/listing/${listing.listingId}`}
        prefetch={false}
        className="block h-full w-full relative group"
      >
        {/* Full width background image - will crop top/bottom for tall images */}
        <div className="absolute inset-0 w-full h-full">
          <Image
            src={imageUrl}
            alt={listingTitle}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          {/* Dark overlay gradient from bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>

        {/* Text overlay in bottom third */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10">
          <div className="max-w-4xl">
            {/* Artist name */}
            {title && (
              <div className="text-[11px] uppercase tracking-[2px] text-[#999999] font-mek-mono mb-2">
                {title}
              </div>
            )}
            
            {/* Listing title */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-light mb-3 text-white line-clamp-2 group-hover:text-[#cccccc] transition-colors">
              {listingTitle}
            </h2>

            {/* Description or artist name */}
            {(description || artistName) && (
              <p className="text-sm md:text-base text-[#cccccc] line-clamp-2">
                {description || artistName}
              </p>
            )}
          </div>
        </div>
      </TransitionLink>
    </section>
  );
}
