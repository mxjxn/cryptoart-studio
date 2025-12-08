"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";
import type { ShareMomentType } from "~/lib/share-moments";
import {
  generateShareCastText,
  generateShareUrl,
  formatPriceForShare,
} from "~/lib/share-moments";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { ShareImageCookingModal } from "~/components/ShareImageCookingModal";
import type { EnrichedAuctionData } from "~/lib/types";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";

interface ShareableMomentButtonProps {
  momentType: ShareMomentType;
  listingId: string;
  auction?: EnrichedAuctionData;
  artworkName?: string;
  artistName?: string;
  artistAddress?: string;
  bidAmount?: string;
  salePrice?: string;
  currentBid?: string;
  customText?: string;
  className?: string;
  buttonText?: string;
}

export function ShareableMomentButton({
  momentType,
  listingId,
  auction,
  artworkName,
  artistName,
  artistAddress,
  bidAmount,
  salePrice,
  currentBid,
  customText,
  className = "",
  buttonText,
}: ShareableMomentButtonProps) {
  const { isSDKLoaded } = useMiniApp();
  const primaryWallet = usePrimaryWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get payment token info for price formatting
  const isPaymentETH = isETH(auction?.erc20);
  const erc20Token = useERC20Token(!isPaymentETH ? auction?.erc20 : undefined);
  const paymentSymbol = isPaymentETH ? "ETH" : (erc20Token.symbol || "$TOKEN");
  const paymentDecimals = isPaymentETH ? 18 : (erc20Token.decimals || 18);

  // Format price for display
  const getDisplayPrice = () => {
    if (salePrice) {
      return formatPriceForShare(salePrice, paymentDecimals);
    }
    if (bidAmount) {
      return formatPriceForShare(bidAmount, paymentDecimals);
    }
    if (currentBid) {
      return formatPriceForShare(currentBid, paymentDecimals);
    }
    if (auction?.initialAmount) {
      return formatPriceForShare(auction.initialAmount, paymentDecimals);
    }
    return null;
  };

  const handleOpenModal = useCallback(() => {
    if (!isSDKLoaded) {
      console.warn("SDK not loaded yet");
      return;
    }
    setIsModalOpen(true);
  }, [isSDKLoaded]);

  const handleShare = useCallback(async (thumbnailUrl: string | null) => {
    if (!isSDKLoaded) {
      console.warn("SDK not loaded yet");
      return;
    }

    try {
      setIsProcessing(true);

      // Generate cast text
      const castText = customText || generateShareCastText(momentType, {
        listingId,
        artworkName: artworkName || auction?.title || auction?.metadata?.title,
        artistName: artistName || auction?.artist,
        artistAddress: artistAddress || auction?.seller,
        bidAmount,
        salePrice,
        currentBid,
      });

      // Generate share URL (the link that will be embedded)
      const shareUrl = generateShareUrl(
        momentType,
        listingId,
        primaryWallet || undefined
      );

      // Add query params for OG image generation if needed
      const ogImageUrl = new URL(shareUrl);
      if (bidAmount) {
        ogImageUrl.searchParams.set("bidAmount", bidAmount);
      }
      if (salePrice) {
        ogImageUrl.searchParams.set("salePrice", salePrice);
      }
      if (currentBid) {
        ogImageUrl.searchParams.set("currentBid", currentBid);
      }

      // Build embeds: thumbnail URL first (if available), then share URL
      const embeds: [string] | [string, string] = thumbnailUrl
        ? [thumbnailUrl, ogImageUrl.toString()]
        : [ogImageUrl.toString()];

      await sdk.actions.composeCast({
        text: castText,
        embeds,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isSDKLoaded,
    momentType,
    listingId,
    auction,
    artworkName,
    artistName,
    bidAmount,
    salePrice,
    currentBid,
    customText,
    primaryWallet,
  ]);

  if (!isSDKLoaded) {
    return null;
  }

  const displayText = buttonText || "Share";
  const artworkUrl = auction?.image || auction?.metadata?.image || null;
  const shareUrl = generateShareUrl(
    momentType,
    listingId,
    primaryWallet || undefined
  );
  const castText = customText || generateShareCastText(momentType, {
    listingId,
    artworkName: artworkName || auction?.title || auction?.metadata?.title,
    artistName: artistName || auction?.artist,
    artistAddress: artistAddress || auction?.seller,
    bidAmount,
    salePrice,
    currentBid,
  });
  const displayPrice = getDisplayPrice();

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isProcessing}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        title={`Share ${momentType}`}
        aria-label={`Share ${momentType}`}
        aria-busy={isProcessing}
      >
        <Share2 className="h-3 w-3" aria-hidden="true" />
        {displayText}
      </button>

      <ShareImageCookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        artworkUrl={artworkUrl}
        shareUrl={shareUrl}
        castText={castText}
        artworkName={artworkName || auction?.title || auction?.metadata?.title}
        artistName={artistName || auction?.artist}
        price={displayPrice || undefined}
        priceSymbol={paymentSymbol}
        onShare={handleShare}
      />
    </>
  );
}

