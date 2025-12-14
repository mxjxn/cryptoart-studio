"use client";

import { TransitionLink } from "~/components/TransitionLink";
import { useUsername } from "~/hooks/useUsername";
import type { EnrichedAuctionData } from "~/lib/types";

interface RecentListingsSectionProps {
  title?: string | null;
  description?: string | null;
  listings: EnrichedAuctionData[];
}

export function RecentListingsSection({
  title,
  description,
  listings,
}: RecentListingsSectionProps) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="px-5 py-8 border-b border-[#333333]">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-light">{title}</h2>
          <TransitionLink
            href="/market"
            className="text-sm text-[#999999] hover:text-white transition-colors"
          >
            View all →
          </TransitionLink>
        </div>
      )}
      {description && (
        <p className="text-sm text-[#999999] mb-6">{description}</p>
      )}
      
      <div className="space-y-3">
        {listings.map((listing) => (
          <RecentListingRow key={listing.listingId} listing={listing} />
        ))}
      </div>
    </section>
  );
}

interface RecentListingRowProps {
  listing: EnrichedAuctionData;
}

function RecentListingRow({ listing }: RecentListingRowProps) {
  const { username } = useUsername(listing.seller || undefined);
  const listingTitle = listing.title || listing.metadata?.name || listing.metadata?.title || "Untitled";
  
  return (
    <TransitionLink
      href={`/listing/${listing.listingId}`}
      className="block text-sm text-white hover:text-[#cccccc] transition-colors py-2 border-b border-[#1a1a1a] last:border-b-0"
    >
      <div className="flex items-center justify-between">
        <span className="truncate flex-1">{listingTitle}</span>
        {username && (
          <span className="text-[#999999] ml-4 flex-shrink-0">by @{username}</span>
        )}
      </div>
    </TransitionLink>
  );
}
