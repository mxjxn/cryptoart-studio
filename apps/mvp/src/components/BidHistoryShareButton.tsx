"use client";

import { useState, useMemo } from "react";
import { Share2, X } from "lucide-react";
import { ShareableMomentButton } from "~/components/ShareableMomentButton";
import type { EnrichedAuctionData } from "~/lib/types";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useUsername } from "~/hooks/useUsername";
import { useArtistName } from "~/hooks/useArtistName";

interface BidHistoryShareButtonProps {
  listingId: string;
  auction: EnrichedAuctionData;
  paymentSymbol: string;
  paymentDecimals: number;
}

export function BidHistoryShareButton({
  listingId,
  auction,
  paymentSymbol,
  paymentDecimals,
}: BidHistoryShareButtonProps) {
  const { address } = useEffectiveAddress();
  const [showOptions, setShowOptions] = useState(false);
  
  // Get top bidder info
  const topBid = auction.bids?.[0];
  const topBidderAddress = topBid?.bidder;
  const { artistName: topBidderName } = useArtistName(
    topBidderAddress || null,
    undefined,
    undefined
  );
  const { username: topBidderUsername } = useUsername(topBidderAddress);

  // Check if user has been outbid (has a bid but is not the top bidder)
  const userHasBeenOutbid = useMemo(() => {
    if (!address || !auction.bids || auction.bids.length === 0) {
      return false;
    }
    const normalizedAddress = address.toLowerCase();
    const hasUserBid = auction.bids.some(
      (bid) => bid.bidder.toLowerCase() === normalizedAddress
    );
    const isTopBidder = topBidderAddress?.toLowerCase() === normalizedAddress;
    return hasUserBid && !isTopBidder;
  }, [address, auction.bids, topBidderAddress]);

  const artworkName = auction.title || auction.metadata?.title || `Auction #${listingId}`;
  const artistName = auction.artist;
  const topBidderDisplayName = topBidderName || topBidderUsername || topBidderAddress?.slice(0, 6) + "..." + topBidderAddress?.slice(-4);

  if (!topBid || !topBidderAddress) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowOptions(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] transition-colors"
        title="Share bid history"
        aria-label="Share bid history"
      >
        <Share2 className="h-3 w-3" aria-hidden="true" />
        Share
      </button>

      {showOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Share Bid History</h3>
              <button
                onClick={() => setShowOptions(false)}
                className="text-[#999999] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div onClick={() => setShowOptions(false)}>
                <ShareableMomentButton
                  momentType="top-bid"
                  listingId={listingId}
                  auction={auction}
                  artworkName={artworkName}
                  artistName={artistName}
                  topBidAmount={topBid.amount}
                  topBidderName={topBidderDisplayName}
                  topBidderAddress={topBidderAddress}
                  paymentSymbol={paymentSymbol}
                  paymentDecimals={paymentDecimals}
                  buttonText="Share Top Bid"
                  className="w-full justify-center"
                />
              </div>

              {userHasBeenOutbid && (
                <div onClick={() => setShowOptions(false)}>
                  <ShareableMomentButton
                    momentType="being-outbid"
                    listingId={listingId}
                    auction={auction}
                    artworkName={artworkName}
                    artistName={artistName}
                    topBidAmount={topBid.amount}
                    topBidderName={topBidderDisplayName}
                    topBidderAddress={topBidderAddress}
                    paymentSymbol={paymentSymbol}
                    paymentDecimals={paymentDecimals}
                    buttonText="Share Being Outbid"
                    className="w-full justify-center"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

