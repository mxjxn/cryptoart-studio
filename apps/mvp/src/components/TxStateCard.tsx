"use client";

import React from "react";
import { getBaseScanUrl } from "~/lib/utils";

interface TxStateCardProps {
  isPending: boolean;      // Waiting for wallet signature
  isConfirming: boolean;   // Transaction submitted, waiting for confirmation
  isSuccess: boolean;      // Transaction confirmed
  error?: Error | null;
  hash?: string;
  onDismiss?: () => void;
}

export function TxStateCard({
  isPending,
  isConfirming,
  isSuccess,
  error,
  hash,
  onDismiss,
}: TxStateCardProps) {
  // Only show if there is some active state or error
  if (!isPending && !isConfirming && !isSuccess && !error) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 shadow-xl shadow-black/20 text-sm">
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {isPending && <Spinner className="w-4 h-4 text-blue-400" />}
          {isConfirming && <Spinner className="w-4 h-4 text-amber-400" />}
          {isSuccess && <CheckIcon className="w-4 h-4 text-green-400" />}
          {error && <ErrorIcon className="w-4 h-4 text-red-400" />}
        </div>

        {/* Status Text */}
        <div className="flex flex-col">
          <span className="font-medium text-white">
            {isPending && "Waiting for signature..."}
            {isConfirming && "Finalizing auction..."}
            {isSuccess && "Auction finalized!"}
            {error && "Transaction failed"}
          </span>
          {/* Optional subtext or link */}
          {(isConfirming || isSuccess) && hash && (
            <a
              href={getBaseScanUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-white/50 hover:text-white/80 transition-colors font-mono mt-0.5"
            >
              View on explorer ↗
            </a>
          )}
          {error && (
            <span className="text-[10px] text-red-300/80 max-w-[200px] truncate">
              {error.message || "Something went wrong"}
            </span>
          )}
        </div>

        {/* Close/Dismiss Button (only for error or success) */}
        {(isSuccess || error) && onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 p-1 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Icons
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className || ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}
