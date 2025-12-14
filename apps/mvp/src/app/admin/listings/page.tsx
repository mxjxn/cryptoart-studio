'use client';

import { useEffect, useState } from 'react';
import type { EnrichedAuctionData } from '~/lib/types';

interface ListingRow extends EnrichedAuctionData {
  formattedStartDate?: string;
  formattedEndDate?: string;
  durationLabel?: string;
  durationValue?: string;
}

function formatTimestamp(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (ts === 0 || isNaN(ts)) return 'N/A';
  
  // Check if it's a year-based value (very large number, like years in seconds)
  // Years in seconds would be > 1 billion (31+ years)
  // Timestamps are typically 10 digits (seconds) or 13 digits (milliseconds)
  // If it's > 1e9 and < 1e12, it's likely a timestamp in seconds
  // If it's > 1e12, it's likely milliseconds
  const date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  return date.toLocaleString();
}

function formatDuration(seconds: string | number): string {
  const secs = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  if (secs === 0 || isNaN(secs)) return 'N/A';
  
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default function AllListingsPage() {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideCancelled, setHideCancelled] = useState(true);

  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/listings?limit=10000');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch listings');
        }

        // Format listings with date logic
        const formatted = data.listings.map((listing: EnrichedAuctionData) => {
          const startTime = parseInt(listing.startTime || '0', 10);
          const endTime = parseInt(listing.endTime || '0', 10);
          
          const row: ListingRow = { ...listing };
          
          // If startTime is 0, endTime represents duration
          if (startTime === 0) {
            row.durationLabel = 'Duration';
            row.durationValue = formatDuration(endTime);
            row.formattedStartDate = 'N/A';
            row.formattedEndDate = 'N/A';
          } else {
            // startTime is a timestamp, so endTime is also a timestamp
            row.formattedStartDate = formatTimestamp(startTime);
            row.durationLabel = 'End Date';
            row.durationValue = formatTimestamp(endTime);
            row.formattedEndDate = formatTimestamp(endTime);
          }
          
          return row;
        });

        // Sort by listingId (already sorted from API, but ensure it)
        formatted.sort((a: ListingRow, b: ListingRow) => {
          const aId = parseInt(a.listingId || '0', 10);
          const bId = parseInt(b.listingId || '0', 10);
          return aId - bId;
        });

        setListings(formatted);
      } catch (err: any) {
        setError(err.message || 'Failed to load listings');
        console.error('Error fetching listings:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[var(--color-secondary)]">Loading listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  // Filter out cancelled listings if checkbox is checked
  const filteredListings = hideCancelled
    ? listings.filter((listing) => listing.status !== 'CANCELLED')
    : listings;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">
          All Listings ({filteredListings.length})
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={(e) => setHideCancelled(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm text-[var(--color-text)]">
            Hide Cancelled
          </span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Listing ID</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">NFT Type</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Listing Type</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Start Date</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Duration/End Date</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Status</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Token Address</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Token ID</th>
              <th className="text-left p-2 font-semibold text-[var(--color-text)]">Seller</th>
            </tr>
          </thead>
          <tbody>
            {filteredListings.map((listing) => (
              <tr
                key={listing.listingId}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-background-hover)]"
              >
                <td className="p-2 text-[var(--color-text)] font-mono">
                  {listing.listingId}
                </td>
                <td className="p-2 text-[var(--color-text)]">
                  {listing.tokenSpec}
                </td>
                <td className="p-2 text-[var(--color-text)]">
                  {listing.listingType}
                </td>
                <td className="p-2 text-[var(--color-secondary)] text-xs">
                  {listing.formattedStartDate}
                </td>
                <td className="p-2 text-[var(--color-secondary)] text-xs">
                  <div>
                    <span className="text-[var(--color-secondary)] text-xs">
                      {listing.durationLabel}:
                    </span>{' '}
                    <span className="text-[var(--color-text)]">
                      {listing.durationValue}
                    </span>
                  </div>
                </td>
                <td className="p-2 text-[var(--color-text)]">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      listing.status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-500'
                        : listing.status === 'FINALIZED'
                        ? 'bg-gray-500/20 text-gray-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}
                  >
                    {listing.status}
                  </span>
                </td>
                <td className="p-2 text-[var(--color-secondary)] font-mono text-xs">
                  {listing.tokenAddress?.slice(0, 10)}...
                </td>
                <td className="p-2 text-[var(--color-secondary)] font-mono text-xs">
                  {listing.tokenId || 'N/A'}
                </td>
                <td className="p-2 text-[var(--color-secondary)] font-mono text-xs">
                  {listing.seller?.slice(0, 10)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
