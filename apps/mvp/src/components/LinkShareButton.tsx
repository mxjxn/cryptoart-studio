"use client";

import { useCallback, useState } from "react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";

interface LinkShareButtonProps {
  url: string;
  className?: string;
}

/**
 * Button to copy link to clipboard
 */
export function LinkShareButton({ url, className = "" }: LinkShareButtonProps) {
  const primaryWallet = usePrimaryWallet();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    try {
      // Add referrer parameter to URL if user has a primary wallet
      let shareUrl = url;
      if (primaryWallet) {
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.set('ref', primaryWallet);
          shareUrl = urlObj.toString();
        } catch (e) {
          // If URL parsing fails, append query parameter manually
          const separator = url.includes('?') ? '&' : '?';
          shareUrl = `${url}${separator}ref=${primaryWallet}`;
        }
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  }, [url, primaryWallet]);

  return (
    <button
      onClick={handleShare}
      disabled={copied}
      className={`flex items-center justify-center w-6 h-6 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={copied ? "Copied!" : "Copy link"}
    >
      {copied ? "✓" : "🔗"}
    </button>
  );
}

