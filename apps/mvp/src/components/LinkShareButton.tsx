"use client";

import { useCallback, useState } from "react";

interface LinkShareButtonProps {
  url: string;
  className?: string;
}

/**
 * Button to copy link to clipboard
 */
export function LinkShareButton({ url, className = "" }: LinkShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  }, [url]);

  return (
    <button
      onClick={handleShare}
      disabled={copied}
      className={`flex items-center justify-center w-6 h-6 text-lg hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${className}`}
      title={copied ? "Copied!" : "Copy link"}
    >
      {copied ? "✓" : "🔗"}
    </button>
  );
}

