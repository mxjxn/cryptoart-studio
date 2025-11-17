/**
 * AuctionDetail component - displays full auction details
 */

'use client';

import { useListing } from '~/hooks/useMarketplace';
import { getNFTMetadata } from '~/lib/nft';
import {
  formatEth,
  getCurrentBidAmount,
  getTimeRemaining,
  formatTimeRemaining,
  getAuctionStatus,
  formatAuctionStatus,
  isAuctionActive,
} from '~/lib/auctions';
import { BidForm } from './BidForm';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { type Address } from 'viem';
import Link from 'next/link';

interface AuctionDetailProps {
  listingId: number | bigint;
}

export function AuctionDetail({ listingId }: AuctionDetailProps) {
  const { listing, isLoading, refetch } = useListing(listingId);
  const [metadata, setMetadata] = useState<{
    name?: string;
    description?: string;
    image?: string;
    [key: string]: any;
  } | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);

  useEffect(() => {
    if (listing?.token) {
      setMetadataLoading(true);
      getNFTMetadata(listing.token.address_ as Address, listing.token.id)
        .then((data) => {
          setMetadata(data);
          setMetadataLoading(false);
        })
        .catch(() => {
          setMetadataLoading(false);
        });
    }
  }, [listing]);

  if (isLoading || !listing) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-gray-200 dark:bg-gray-700 h-96 rounded"></div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const currentBid = getCurrentBidAmount(listing);
  const reservePrice = listing.details.initialAmount;
  const timeRemaining = getTimeRemaining(listing);
  const status = getAuctionStatus(listing);
  const isActive = isAuctionActive(listing);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Back to Auctions
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NFT Image */}
        <div className="relative w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          {metadataLoading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Loading...
            </div>
          ) : metadata?.image ? (
            <Image
              src={metadata.image}
              alt={metadata.name || 'NFT'}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image Available
            </div>
          )}
        </div>

        {/* Auction Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {metadata?.name || `Token #${listing.token.id.toString()}`}
            </h1>
            {metadata?.description && (
              <p className="text-gray-600 dark:text-gray-400">{metadata.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className="font-semibold">{formatAuctionStatus(status)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Reserve Price</span>
                  <span className="font-semibold">{formatEth(reservePrice)} ETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Bid</span>
                  <span className="font-semibold text-lg">
                    {listing.bid.amount > 0n ? formatEth(currentBid) : 'No bids yet'}
                  </span>
                </div>
                {listing.bid.bidder !== '0x0000000000000000000000000000000000000000' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Bidder</span>
                    <span className="font-mono text-sm">
                      {listing.bid.bidder.slice(0, 6)}...{listing.bid.bidder.slice(-4)}
                    </span>
                  </div>
                )}
                {isActive && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Time Remaining</span>
                    <span className="font-semibold">{formatTimeRemaining(timeRemaining)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Seller</span>
                  <span className="font-mono text-sm">
                    {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Token Contract</span>
                  <span className="font-mono text-sm">
                    {listing.token.address_.slice(0, 6)}...{listing.token.address_.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Token ID</span>
                  <span className="font-mono text-sm">#{listing.token.id.toString()}</span>
                </div>
              </div>
            </div>

            {isActive && <BidForm listingId={listingId} onSuccess={refetch} />}
          </div>
        </div>
      </div>
    </div>
  );
}

