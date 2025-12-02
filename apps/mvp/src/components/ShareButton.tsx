"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { formatEther } from "viem";

interface ShareButtonProps {
  url: string;
  artworkUrl?: string | null;
  title: string;
  artistName?: string | null;
  artistAddress?: string | null;
  sellerAddress: string;
  sellerName?: string | null;
  reservePrice: string;
  currentBid?: string | null;
  bidderAddress?: string | null;
  bidderName?: string | null;
  hasBids: boolean;
  className?: string;
}

/**
 * Format cast text according to specification:
 * {artwork title}
 * by {artist name}
 * {if artist !== seller: auction by {seller}}
 * {noBids ? "reserve" : "current bid by {bidder name}"}
 */
function formatCastText({
  title,
  artistName,
  artistAddress,
  sellerAddress,
  sellerName,
  reservePrice,
  currentBid,
  bidderAddress,
  bidderName,
  hasBids,
}: {
  title: string;
  artistName?: string | null;
  artistAddress?: string | null;
  sellerAddress: string;
  sellerName?: string | null;
  reservePrice: string;
  currentBid?: string | null;
  bidderAddress?: string | null;
  bidderName?: string | null;
  hasBids: boolean;
}): string {
  const lines: string[] = [];
  
  // Line 1: Artwork title
  lines.push(title);
  
  // Line 2: by {artist name}
  if (artistName) {
    lines.push(`by ${artistName}`);
  }
  
  // Line 3: {if artist !== seller: auction by {seller}}
  const artistAddr = artistAddress?.toLowerCase();
  const sellerAddr = sellerAddress?.toLowerCase();
  if (artistAddr && sellerAddr && artistAddr !== sellerAddr) {
    const sellerDisplay = sellerName || sellerAddress;
    lines.push(`auction by ${sellerDisplay}`);
  }
  
  // Line 4: {noBids ? "{price} ETH reserve" : "{price} ETH current bid by {bidder name}"}
  if (hasBids && currentBid) {
    const currentBidEth = formatEther(BigInt(currentBid));
    const bidderDisplay = bidderName || bidderAddress || "unknown";
    lines.push(`${currentBidEth} ETH current bid by ${bidderDisplay}`);
  } else {
    const reserveEth = formatEther(BigInt(reservePrice));
    lines.push(`${reserveEth} ETH reserve`);
  }
  
  return lines.join("\n");
}

export function ShareButton({
  url,
  artworkUrl,
  title,
  artistName,
  artistAddress,
  sellerAddress,
  sellerName,
  reservePrice,
  currentBid,
  bidderAddress,
  bidderName,
  hasBids,
  className = "",
}: ShareButtonProps) {
  const { isSDKLoaded } = useMiniApp();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!isSDKLoaded) {
      console.warn("SDK not loaded yet");
      return;
    }

    try {
      setIsProcessing(true);
      
      // Build embeds: artwork URL first, then miniapp URL
      const embeds: [string] | [string, string] = artworkUrl
        ? [artworkUrl, url]
        : [url];
      
      // Format cast text
      const castText = formatCastText({
        title,
        artistName,
        artistAddress,
        sellerAddress,
        sellerName,
        reservePrice,
        currentBid: currentBid || null,
        bidderAddress: bidderAddress || null,
        bidderName: bidderName || null,
        hasBids,
      });
      
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
    url,
    artworkUrl,
    title,
    artistName,
    artistAddress,
    sellerAddress,
    sellerName,
    reservePrice,
    currentBid,
    bidderAddress,
    bidderName,
    hasBids,
  ]);

  if (!isSDKLoaded) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      disabled={isProcessing}
      className={`flex items-center justify-center w-6 h-6 text-lg hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${className}`}
      title="Share a Cast"
    >
      {isProcessing ? "⏳" : "📤"}
    </button>
  );
}

