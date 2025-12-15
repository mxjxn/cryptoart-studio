"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { useAuthMode } from "./useAuthMode";

interface NetworkGuardState {
  /** True if user is connected but on wrong chain (not Base) */
  isWrongNetwork: boolean;
  /** Function to switch to Base network */
  switchToBase: () => void;
  /** True while chain switch is in progress */
  isSwitching: boolean;
  /** Error from chain switch attempt */
  error: Error | null;
}

/**
 * Hook to detect and handle wrong network connections on web.
 * Only active for web context - miniapp handles chain switching automatically.
 * 
 * @returns {NetworkGuardState} Object containing:
 *   - isWrongNetwork: true if connected wallet is on wrong chain
 *   - switchToBase: function to trigger chain switch
 *   - isSwitching: true during switch operation
 *   - error: any error from switch attempt
 */
export function useNetworkGuard(): NetworkGuardState {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();

  // Only check network on web context, not miniapp
  // Also don't flag as wrong network while auth mode is still loading
  const isWrongNetwork = 
    !authModeLoading && 
    !isMiniApp && 
    isConnected && 
    chainId !== base.id;

  const switchToBase = () => {
    if (switchChain) {
      switchChain({ chainId: base.id });
    }
  };

  return {
    isWrongNetwork,
    switchToBase,
    isSwitching: isPending,
    error: error ?? null,
  };
}









