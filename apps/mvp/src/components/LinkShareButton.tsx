"use client";

import { useCallback, useState, useRef, useEffect } from "react";
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleShare = useCallback(async () => {
    try {
      // Add referralAddress parameter to URL if user has a primary wallet
      let shareUrl = url;
      if (primaryWallet) {
        try {
          const urlObj = new URL(url);
          // Ensure address has 0x prefix
          const referralAddress = primaryWallet.startsWith('0x') ? primaryWallet : `0x${primaryWallet}`;
          urlObj.searchParams.set('referralAddress', referralAddress);
          shareUrl = urlObj.toString();
        } catch (e) {
          // If URL parsing fails, append query parameter manually
          const separator = url.includes('?') ? '&' : '?';
          const referralAddress = primaryWallet.startsWith('0x') ? primaryWallet : `0x${primaryWallet}`;
          shareUrl = `${url}${separator}referralAddress=${referralAddress}`;
        }
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Set new timer
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  }, [url, primaryWallet]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <button
      onClick={handleShare}
      disabled={copied}
      className={`flex items-center justify-center w-6 h-6 text-xs text-[#999999] hover:text-[#cccccc] border border-[#333333] hover:border-[#666666] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={copied ? "Copied!" : "Copy link"}
      aria-label={copied ? "Link copied to clipboard" : "Copy link to clipboard"}
      aria-live="polite"
    >
      <span aria-hidden="true">{copied ? "✓" : "🔗"}</span>
    </button>
  );
}

