import React from 'react';
import { getPrerenderedListingCardData } from '~/lib/server/listing-card-prerender';
import { AuctionCardClient } from './AuctionCardClient';
import type { EnrichedAuctionData } from '~/lib/types';

interface AuctionCardServerProps {
  listingId: string;
  gradient: string;
  index: number;
  referralAddress?: string | null;
  // Optional: if auction data is already available, pass it to avoid re-fetching
  auction?: EnrichedAuctionData;
}

/**
 * Server component that renders listing card with pre-rendered static data
 * Dynamic auction data (bids, prices, status) is loaded client-side
 */
export async function AuctionCardServer({
  listingId,
  gradient,
  index,
  referralAddress,
  auction: providedAuction,
}: AuctionCardServerProps) {
  // Get pre-rendered static data
  const staticData = await getPrerenderedListingCardData(listingId);
  
  // If we have provided auction data, use it
  // Otherwise, the client component will fetch it
  const auction = providedAuction || null;
  
  return (
    <AuctionCardClient
      listingId={listingId}
      staticData={staticData}
      auction={auction}
      gradient={gradient}
      index={index}
      referralAddress={referralAddress}
    />
  );
}
