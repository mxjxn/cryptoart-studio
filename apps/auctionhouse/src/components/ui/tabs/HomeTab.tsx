/**
 * HomeTab component - displays active auctions from API
 */

'use client';

import { AuctionList } from '~/components/auctions/AuctionList';
import { useActiveAuctions } from '~/hooks/useApi';

export function HomeTab() {
  const { listings, loading, error } = useActiveAuctions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading auctions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-red-600 dark:text-red-400 mb-2">
            Error loading auctions
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  const listingIds = listings.map((l) => l.listingId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Active Auctions</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Browse and bid on available NFT auctions
        </p>
      </div>
      <AuctionList listingIds={listingIds} />
    </div>
  );
}
