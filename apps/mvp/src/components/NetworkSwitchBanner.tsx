"use client";

import { useNetworkGuard } from "~/hooks/useNetworkGuard";

/**
 * Banner component that prompts web users to switch to Base network
 * when they're connected with the wrong chain.
 * 
 * Only renders on web context (not in miniapp) and only when wallet
 * is connected to a non-Base network.
 */
export function NetworkSwitchBanner() {
  const { isWrongNetwork, switchToBase, isSwitching, error } = useNetworkGuard();

  // Don't render if on correct network
  if (!isWrongNetwork) {
    return null;
  }

  return (
    <div className="w-full bg-amber-900/90 border-b border-amber-700">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <WarningIcon className="h-5 w-5 text-amber-300 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">
                Wrong network detected
              </p>
              <p className="text-xs text-amber-200">
                This app runs on Base. Switch networks to continue.
              </p>
            </div>
          </div>
          
          <button
            onClick={switchToBase}
            disabled={isSwitching}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSwitching ? (
              <>
                <Spinner className="h-4 w-4" />
                Switching...
              </>
            ) : (
              <>
                <BaseIcon className="h-4 w-4" />
                Switch to Base
              </>
            )}
          </button>
        </div>
        
        {error && (
          <p className="text-xs text-red-300 mt-2">
            Failed to switch: {error.message.slice(0, 100)}
            {error.message.length > 100 ? '...' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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

function BaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 111 111"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
    </svg>
  );
}









