"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { generateShareUrl, generateShareCastText } from "~/lib/share-moments";
import { ShareImageCookingModal } from "~/components/ShareImageCookingModal";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      
      // Build embeds: thumbnail URL first (if available), then share URL
      const embeds: [string] | [string, string] = thumbnailUrl
        ? [thumbnailUrl, shareUrl]
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
  }, [isSDKLoaded, url, text, primaryWallet, listingId, artworkName, artistName]);

  if (!isSDKLoaded) {
    return null;
  }

  // Prepare share URL and text for modal
  const shareUrl = listingId
    ? generateShareUrl("referral", listingId, primaryWallet || undefined)
    : url;
  const castText = listingId
    ? text || generateShareCastText("referral", {
        listingId,
        artworkName,
        artistName,
      })
    : text || "Check out this auction!";

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isProcessing}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        title="Share a Cast"
        aria-label="Share this listing as a cast"
        aria-busy={isProcessing}
      >
        <Share2 className="h-3 w-3" aria-hidden="true" />
        Share
      </button>

      <ShareImageCookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        artworkUrl={artworkUrl}
        shareUrl={shareUrl}
        castText={castText}
        artworkName={artworkName}
        artistName={artistName}
        onShare={handleShare}
      />
    </>
  );
}

