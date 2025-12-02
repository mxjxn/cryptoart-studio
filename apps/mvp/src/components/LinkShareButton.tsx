"use client";

import { useCallback, useState } from "react";
import { Link2 } from "lucide-react";

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
      className={`flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      title={copied ? "Copied!" : "Copy link"}
    >
      <Link2 className="h-4 w-4" />
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

