"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Small copy-to-clipboard button component.
 * Shows a checkmark icon briefly after copying.
 */
export function CopyButton({ text, className = "", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const sizeClasses = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center rounded hover:bg-[#1a1a1a] transition-colors ${className}`}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-400"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#999999]"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

