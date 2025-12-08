"use client";

import { useRouter } from "next/navigation";
import { ShareableMomentButton } from "~/components/ShareableMomentButton";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import type { EnrichedAuctionData } from "~/lib/types";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { formatPriceForShare } from "~/lib/share-moments";

interface OutbidSharePageClientProps {
  listingId: string;
  auction: EnrichedAuctionData;
  currentBid?: string;
  referralId?: string;
}

export function OutbidSharePageClient({
  listingId,
  auction,
  currentBid,
  referralId,
}: OutbidSharePageClientProps) {
  const router = useRouter();

  // Get payment token info for price formatting
  const isPaymentETH = isETH(auction.erc20);
  const erc20Token = useERC20Token(!isPaymentETH ? auction.erc20 : undefined);
  const paymentSymbol = isPaymentETH ? "ETH" : (erc20Token.symbol || "$TOKEN");
  const paymentDecimals = isPaymentETH ? 18 : (erc20Token.decimals || 18);

  // Format current bid for display
  const displayBid = currentBid
    ? formatPriceForShare(currentBid, paymentDecimals)
    : auction.highestBid?.amount
    ? formatPriceForShare(auction.highestBid.amount, paymentDecimals)
    : null;

  const artworkName =
    auction.title || auction.metadata?.title || `Auction #${listingId}`;
  const artistName = auction.artist || auction.seller;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-[#333333] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <TransitionLink href="/" aria-label="Home">
            <Logo />
          </TransitionLink>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-light mb-2">You've been outbid 🔥</h1>
            <p className="text-[#999999] text-sm">
              {artworkName} has a new highest bid
            </p>
          </div>

          {/* Artwork Info */}
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 space-y-4">
            <div>
              <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">
                Artwork
              </div>
              <div className="text-lg text-white font-light">{artworkName}</div>
            </div>

            {artistName && (
              <div>
                <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">
                  Artist
                </div>
                <div className="text-sm text-[#cccccc] font-mono">
                  {artistName}
                </div>
              </div>
            )}

            {displayBid && (
              <div>
                <div className="text-xs text-[#666666] uppercase tracking-wider mb-1">
                  Current Bid
                </div>
                <div className="text-sm text-[#cccccc] font-mono">
                  {displayBid} {paymentSymbol}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <ShareableMomentButton
              momentType="outbid"
              listingId={listingId}
              auction={auction}
              artworkName={artworkName}
              currentBid={currentBid || auction.highestBid?.amount}
              buttonText="Share This Moment"
              className="w-full"
            />

            <TransitionLink
              href={`/auction/${listingId}${referralId ? `?referralId=${referralId}` : ""}`}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#1a1a1a] transition-colors text-center"
            >
              View Listing
            </TransitionLink>
          </div>
        </div>
      </main>
    </div>
  );
}

