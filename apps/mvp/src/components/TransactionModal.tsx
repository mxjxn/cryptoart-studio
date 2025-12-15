"use client";

import { useEffect } from "react";
import { useAuthMode } from "~/hooks/useAuthMode";
import { X } from "lucide-react";

interface TransactionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isPending: boolean; // Waiting for wallet signature
  isConfirming: boolean; // Transaction submitted, waiting for confirmation
  isSuccess: boolean; // Transaction confirmed
  error?: Error | null;
  amount: string;
  symbol: string;
  action: "bid" | "purchase" | "offer" | "approve";
  transactionHash?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  isPending,
  isConfirming,
  isSuccess,
  error,
  amount,
  symbol,
  action,
  transactionHash,
}: TransactionModalProps) {
  const { isMiniApp } = useAuthMode();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose && (isSuccess || error)) {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSuccess, error]);

  if (!isOpen) return null;

  const getActionText = () => {
    switch (action) {
      case "bid":
        return "bid";
      case "purchase":
        return "purchase";
      case "offer":
        return "offer";
      case "approve":
        return "approval";
      default:
        return "transaction";
    }
  };

  const getBaseScanUrl = (hash: string) => {
    return `https://basescan.org/tx/${hash}`;
  };

  return (
    <div
      className={`fixed z-50 flex items-center justify-center bg-black/95 animate-in fade-in duration-200 ${
        isMiniApp ? "inset-0" : "inset-0 md:inset-4 md:rounded-lg"
      }`}
      onClick={(e) => {
        if ((isSuccess || error) && onClose) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction status"
    >
      <div
        className="w-full max-w-md mx-4 bg-[#1a1a1a] border border-[#333333] rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - only show on success or error */}
        {(isSuccess || error) && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Pending state - Waiting for wallet signature */}
        {isPending && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-light text-white mb-2">
              Your {amount} {symbol} {getActionText()} is on its way!
            </h2>
            <p className="text-sm text-[#999999]">
              Please confirm the transaction in your wallet
            </p>
          </div>
        )}

        {/* Confirming state - Transaction submitted */}
        {isConfirming && !isPending && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-light text-white mb-2">
              Transaction submitted
            </h2>
            <p className="text-sm text-[#999999] mb-4">
              Waiting for on-chain confirmation...
            </p>
            {transactionHash && (
              <a
                href={getBaseScanUrl(transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 underline font-mono"
              >
                View on BaseScan ↗
              </a>
            )}
          </div>
        )}

        {/* Success state */}
        {isSuccess && !isPending && !isConfirming && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-light text-white mb-2">
              {action === "bid" ? "Bid placed!" : action === "purchase" ? "Purchase complete!" : "Success!"}
            </h2>
            <p className="text-sm text-[#999999] mb-4">
              Your {amount} {symbol} {getActionText()} has been confirmed
            </p>
            {transactionHash && (
              <a
                href={getBaseScanUrl(transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 underline font-mono"
              >
                View on BaseScan ↗
              </a>
            )}
          </div>
        )}

        {/* Error state */}
        {error && !isPending && !isConfirming && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-light text-white mb-2">
              Transaction failed
            </h2>
            <p className="text-sm text-red-400 mb-4">
              {error.message || "Something went wrong. Please try again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}







