"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { generateShareUrl, generateShareCastText } from "~/lib/share-moments";

interface ShareButtonProps {
  url: string;
  artworkUrl?: string | null;
  text?: string;
  className?: string;
  listingId?: string; // Optional listingId to use referral share endpoint
  artworkName?: string;
  artistName?: string;
}

export function ShareButton({ 
  url, 
  artworkUrl, 
  text, 
  className = "",
  listingId,
  artworkName,
  artistName,
}: ShareButtonProps) {
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
      
      // If listingId is provided, use the referral share endpoint
      let shareUrl: string;
      let castText: string;
      
      if (listingId) {
        // Use referral share endpoint
        shareUrl = generateShareUrl("referral", listingId, primaryWallet || undefined);
        castText = text || generateShareCastText("referral", {
          listingId,
          artworkName,
          artistName,
        });
      } else {
        // Use original URL with referralId
        shareUrl = url;
        if (primaryWallet) {
          try {
            const urlObj = new URL(url);
            // Ensure address has 0x prefix
            const referralId = primaryWallet.startsWith('0x') ? primaryWallet : `0x${primaryWallet}`;
            urlObj.searchParams.set('referralId', referralId);
            shareUrl = urlObj.toString();
          } catch (e) {
            // If URL parsing fails, append query parameter manually
            const separator = url.includes('?') ? '&' : '?';
            const referralId = primaryWallet.startsWith('0x') ? primaryWallet : `0x${primaryWallet}`;
            shareUrl = `${url}${separator}referralId=${referralId}`;
          }
        }
        castText = text || "Check out this auction!";
      }
      
      // Build embeds: artwork URL first, then share URL
      const embeds: [string] | [string, string] = artworkUrl
        ? [artworkUrl, shareUrl]
        : [shareUrl];
      
      await sdk.actions.composeCast({
        text: castText,
        embeds,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isSDKLoaded, url, artworkUrl, text, primaryWallet, listingId, artworkName, artistName]);

  if (!isSDKLoaded) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      disabled={isProcessing}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={isProcessing ? "Sharing..." : "Share a Cast"}
      aria-label={isProcessing ? "Sharing cast" : "Share this listing as a cast"}
      aria-busy={isProcessing}
    >
      <Share2 className="h-3 w-3" aria-hidden="true" />
      {isProcessing ? "..." : "Share"}
    </button>
  );
}

