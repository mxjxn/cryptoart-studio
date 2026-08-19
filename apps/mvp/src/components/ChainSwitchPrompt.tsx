"use client";

import { base, mainnet } from "wagmi/chains";
import { useNetworkGuard } from "~/hooks/useNetworkGuard";

interface ChainSwitchPromptProps {
  /** Whether to show the prompt */
  show: boolean;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
  /** Target chain for the switch button (defaults to Base). */
  requiredChainId?: number;
  /** Display name for the target chain (e.g. "Base", "Ethereum"). */
  targetNetworkLabel?: string;
  /** Optional browser fallback for miniapp wallets that cannot switch. */
  onOpenInBrowser?: () => void;
}

/**
 * Minimal toast-style prompt to switch networks when the wallet is on the wrong chain.
 */
export function ChainSwitchPrompt({
  show,
  onDismiss,
  requiredChainId,
  targetNetworkLabel,
  onOpenInBrowser,
}: ChainSwitchPromptProps) {
  const resolvedChainId = requiredChainId ?? base.id;
  const label =
    targetNetworkLabel ??
    (resolvedChainId === mainnet.id ? "Ethereum" : "Base");
  const { switchToRequiredChain, isSwitching } = useNetworkGuard({
    requiredChainId: resolvedChainId,
  });

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-1">
              Switch to {label}
            </p>
            <p className="text-xs text-gray-600">
              Confirm the switch in your wallet if a popup appears. Many wallets have no switch-network button of their own.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={switchToRequiredChain}
              disabled={isSwitching}
              className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSwitching ? `Switching to ${label}...` : "Switch"}
            </button>
            {onOpenInBrowser && (
              <button
                onClick={onOpenInBrowser}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors"
              >
                Open in browser
              </button>
            )}
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
