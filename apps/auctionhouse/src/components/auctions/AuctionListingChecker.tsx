/**
 * Component that checks multiple listings and filters for active auctions
 * For MVP, displays all listings and lets AuctionCard filter
 */

'use client';

import { AuctionList } from './AuctionList';

interface AuctionListingCheckerProps {
  listingIds: (number | bigint)[];
}

export function AuctionListingChecker({ listingIds }: AuctionListingCheckerProps) {
  // For MVP, show all listings - AuctionCard will filter out non-auctions
  // In production, this would be filtered server-side via backend API
  return <AuctionList listingIds={listingIds} />;
}

