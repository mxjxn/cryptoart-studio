/**
 * AuctionList component - displays a grid/list of auctions
 */

'use client';

import { AuctionCard } from './AuctionCard';

interface AuctionListProps {
  listingIds: (number | bigint)[];
}

export function AuctionList({ listingIds }: AuctionListProps) {
  if (listingIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">No auctions found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Check back soon for new auctions!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listingIds.map((id) => (
        <AuctionCard key={id.toString()} listingId={id} />
      ))}
    </div>
  );
}

