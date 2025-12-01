"use client";

import { getBaseScanUrl } from "~/lib/utils";

interface TransactionStatusProps {
  hash?: `0x${string}`;
  isPending: boolean;      // Waiting for user signature
  isConfirming: boolean;   // Tx submitted, waiting for confirmation
  isSuccess: boolean;      // Tx confirmed
  error?: Error | null;
  successMessage?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function TransactionStatus({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  successMessage = "Transaction confirmed!",
  onDismiss,
  onRetry,
}: TransactionStatusProps) {
  // Idle state - nothing to show
  if (!isPending && !isConfirming && !isSuccess && !error) {
    return null;
  }

  // Pending signature state
  if (isPending) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Spinner className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              Waiting for wallet signature...
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Please confirm the transaction in your wallet
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Confirming state (tx submitted, waiting for on-chain confirmation)
  if (isConfirming && hash) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Spinner className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              Transaction submitted. Confirming...
            </p>
            <a
              href={getBaseScanUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:text-amber-900 underline mt-1 inline-block font-mono"
            >
              View on BaseScan ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <CheckIcon className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {successMessage}
            </p>
            {hash && (
              <a
                href={getBaseScanUrl(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 hover:text-green-900 underline mt-1 inline-block font-mono"
              >
                View transaction on BaseScan ↗
              </a>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-green-600 hover:text-green-800"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    // Parse error message for better UX
    let errorMessage = error.message || "Transaction failed. Please try again.";
    
    // Truncate very long error messages
    if (errorMessage.length > 200) {
      errorMessage = errorMessage.slice(0, 200) + "...";
    }

    // Check for common error types
    const isUserRejected = errorMessage.toLowerCase().includes("rejected") || 
                           errorMessage.toLowerCase().includes("denied") ||
                           errorMessage.toLowerCase().includes("cancelled");

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <ErrorIcon className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {isUserRejected ? "Transaction cancelled" : "Transaction failed"}
            </p>
            <p className="text-xs text-red-600 mt-1">
              {isUserRejected 
                ? "You rejected the transaction in your wallet."
                : errorMessage
              }
            </p>
            {onRetry && !isUserRejected && (
              <button
                onClick={onRetry}
                className="text-xs text-red-700 hover:text-red-900 underline mt-2 inline-block"
              >
                Try again
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// Simple inline icons to avoid external dependencies
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

