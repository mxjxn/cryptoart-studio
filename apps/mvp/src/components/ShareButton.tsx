"use client";

import { useCallback, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  url: string;
  text?: string;
  className?: string;
}

export function ShareButton({ url, text, className = "" }: ShareButtonProps) {
  const { isSDKLoaded } = useMiniApp();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!isSDKLoaded) {
      console.warn("SDK not loaded yet");
      return;
    }

    try {
      setIsProcessing(true);
      
      await sdk.actions.composeCast({
        text: text || "Check out this auction!",
        embeds: [url],
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isSDKLoaded, url, text]);

  if (!isSDKLoaded) {
    return null;
  }

  return (
    <button
      onClick={handleShare}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      <Share2 className="h-4 w-4" />
      {isProcessing ? "Sharing..." : "Share"}
    </button>
  );
}

