"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  url: string;
  artworkUrl?: string | null;
  text?: string;
  className?: string;
}

export function ShareButton({ url, artworkUrl, text, className = "" }: ShareButtonProps) {
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
      
      await sdk.actions.composeCast({
        text: text || "Check out this auction!",
        embeds,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isSDKLoaded, url, artworkUrl, text]);

  if (!isSDKLoaded) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      disabled={isProcessing}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={isProcessing ? "Sharing..." : "Share a Cast"}
    >
      <Share2 className="h-3 w-3" />
      {isProcessing ? "..." : "Share"}
    </button>
  );
}

