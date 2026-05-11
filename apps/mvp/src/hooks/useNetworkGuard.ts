"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { useAuthMode } from "./useAuthMode";

export type UseNetworkGuardOptions = {
  /** Chain the user must be on for listing actions (defaults to Base). */
  requiredChainId?: number;
};

interface NetworkGuardState {
  /** True if user is connected but on the wrong chain for the current context */
  isWrongNetwork: boolean;
  /** Switch to Base (legacy callers / Base-only flows). */
  switchToBase: () => void;
  /** Switch to `requiredChainId` (or Base if none was passed). */
  switchToRequiredChain: () => void;
  isSwitching: boolean;
  error: Error | null;
}

/**
 * Hook to detect and handle wrong network connections on web.
 * Only active for web context - miniapp handles chain switching automatically.
 */
export function useNetworkGuard(opts?: UseNetworkGuardOptions): NetworkGuardState {
  const requiredChainId = opts?.requiredChainId ?? base.id;
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();

  const isWrongNetwork =
    !authModeLoading &&
    !isMiniApp &&
    isConnected &&
    chainId !== requiredChainId;

  const switchToRequiredChain = () => {
    if (switchChain) {
      switchChain({ chainId: requiredChainId });
    }
  };

  const switchToBase = () => {
    if (switchChain) {
      switchChain({ chainId: base.id });
    }
  };

  return {
    isWrongNetwork,
    switchToBase,
    switchToRequiredChain,
    isSwitching: isPending,
    error: error ?? null,
  };
}
