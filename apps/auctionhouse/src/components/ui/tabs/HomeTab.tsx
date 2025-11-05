/**
 * HomeTab component - displays active auctions
 */

'use client';

import { AuctionList } from '~/components/auctions/AuctionList';
import { AuctionListingChecker } from '~/components/auctions/AuctionListingChecker';

// For MVP, we'll check a range of listing IDs
// In production, this would come from the backend indexer API
const LISTING_ID_RANGE = Array.from({ length: 20 }, (_, i) => i + 1);

export function HomeTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Active Auctions</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Browse and bid on available NFT auctions
        </p>
      </div>
      <AuctionListingChecker listingIds={LISTING_ID_RANGE} />
    </div>
  );
}
