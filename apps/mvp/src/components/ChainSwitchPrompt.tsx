"use client";

import { useNetworkGuard } from "~/hooks/useNetworkGuard";
import { useAuthMode } from "~/hooks/useAuthMode";

interface ChainSwitchPromptProps {
  /** Whether to show the prompt */
  show: boolean;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
}

/**
 * Minimal, low-attention prompt to switch to Base network.
 * Appears as a small toast-style notification when chainId is missing or wrong.
 */
export function ChainSwitchPrompt({ show, onDismiss }: ChainSwitchPromptProps) {
  const { switchToBase, isSwitching } = useNetworkGuard();
  const { isMiniApp } = useAuthMode();

  if (!show || isMiniApp) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-1">
              Switch to Base
            </p>
            <p className="text-xs text-gray-600">
              Please switch to Base network to continue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={switchToBase}
              disabled={isSwitching}
              className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSwitching ? "Switching..." : "Switch"}
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

