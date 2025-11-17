/**
 * AuctionCard component - displays a single auction in a card format
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useListing } from '~/hooks/useMarketplace';
import { getNFTMetadata } from '~/lib/nft';
import {
  formatEth,
  getCurrentBidAmount,
  getTimeRemaining,
  formatTimeRemaining,
  isAuctionActive,
  getAuctionStatus,
} from '~/lib/auctions';
import { useEffect, useState } from 'react';
import { type Address } from 'viem';

interface AuctionCardProps {
  listingId: number | bigint;
}

export function AuctionCard({ listingId }: AuctionCardProps) {
  const { listing, isLoading } = useListing(listingId);
  const [metadata, setMetadata] = useState<{ name?: string; image?: string } | null>(null);

  useEffect(() => {
    if (listing?.token) {
      getNFTMetadata(listing.token.address_ as Address, listing.token.id).then(setMetadata);
    }
  }, [listing]);

  if (isLoading || !listing) {
    return (
      <div className="border rounded-lg p-4 animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-700 h-48 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  // Only show INDIVIDUAL_AUCTION listings
  if (listing.details.type_ !== 1) {
    return null;
  }

  const currentBid = getCurrentBidAmount(listing);
  const timeRemaining = getTimeRemaining(listing);
  const status = getAuctionStatus(listing);
  const isActive = isAuctionActive(listing);

  return (
    <Link href={`/auction/${listingId}`}>
      <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800">
          {metadata?.image ? (
            <Image
              src={metadata.image}
              alt={metadata.name || 'NFT'}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-2 truncate">
            {metadata?.name || `Token #${listing.token.id.toString()}`}
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Bid</span>
              <span className="font-semibold">{formatEth(currentBid)} ETH</span>
            </div>
            {isActive && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Time Remaining</span>
                <span className="text-sm font-medium">{formatTimeRemaining(timeRemaining)}</span>
              </div>
            )}
            {!isActive && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <span className="text-sm font-medium">{status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

