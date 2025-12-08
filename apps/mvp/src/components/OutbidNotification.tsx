"use client";

import { useRouter } from "next/navigation";
import { ShareableMomentButton } from "./ShareableMomentButton";
import type { EnrichedAuctionData } from "~/lib/types";

interface OutbidNotificationProps {
  listingId: string;
  auction?: EnrichedAuctionData;
  artworkName?: string;
  currentBid?: string;
  onDismiss?: () => void;
}

export function OutbidNotification({
  listingId,
  auction,
  artworkName,
  currentBid,
  onDismiss,
}: OutbidNotificationProps) {
  const router = useRouter();

  const handleViewListing = () => {
    router.push(`/auction/${listingId}`);
    onDismiss?.();
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">
            You've been outbid 🔥
          </h3>
          <p className="text-[#999999] text-sm mb-3">
            {artworkName || auction?.title || `Auction #${listingId}`} has a new
            highest bid
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleViewListing}
              className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors rounded"
            >
              View Listing
            </button>
            <ShareableMomentButton
              momentType="outbid"
              listingId={listingId}
              auction={auction}
              artworkName={artworkName}
              currentBid={currentBid}
              buttonText="Share"
            />
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[#666666] hover:text-[#999999] transition-colors"
            aria-label="Dismiss"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

