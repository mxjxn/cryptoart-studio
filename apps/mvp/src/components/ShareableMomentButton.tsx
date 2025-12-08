"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";
import type { ShareMomentType } from "~/lib/share-moments";
import {
  generateShareCastText,
  generateShareUrl,
} from "~/lib/share-moments";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import type { EnrichedAuctionData } from "~/lib/types";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const handleShare = useCallback(async () => {
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

      // Get artwork image URL for embed
      const artworkUrl = auction?.image || auction?.metadata?.image || null;

      // Build embeds: artwork URL first (if available), then share URL
      const embeds: [string] | [string, string] = artworkUrl
        ? [artworkUrl, ogImageUrl.toString()]
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

  return (
    <button
      onClick={handleShare}
      disabled={isProcessing}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={isProcessing ? "Sharing..." : `Share ${momentType}`}
    >
      <Share2 className="h-3 w-3" />
      {isProcessing ? "..." : displayText}
    </button>
  );
}

