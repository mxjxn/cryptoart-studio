"use client";

import { useCallback, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { addEthereumChainParameterFor } from "~/lib/chain-rpc";
import { isUnrecognizedChainError } from "~/lib/wallet-error-utils";
import { useAuthMode } from "./useAuthMode";

export type UseNetworkGuardOptions = {
  /**
   * Chain the user must be on for listing actions.
   * Omit or leave `undefined` to skip wrong-network detection (e.g. before the user picks a target chain).
   */
  requiredChainId?: number;
};

interface NetworkGuardState {
  /** True if user is connected but on the wrong chain for the current context */
  isWrongNetwork: boolean;
  /** Switch to Base (legacy callers / Base-only flows). */
  switchToBase: () => Promise<void>;
  /** Prompt the wallet (`wallet_switchEthereumChain` / `wallet_addEthereumChain`) to `requiredChainId`. */
  switchToRequiredChain: () => Promise<void>;
  isSwitching: boolean;
  error: Error | null;
}

/**
 * Hook to detect and handle wrong network connections.
 *
 * Many wallets have no in-wallet "switch network" UI. The dapp must send
 * `wallet_switchEthereumChain`, and `wallet_addEthereumChain` when the chain
 * is missing (EIP-1193 error 4902).
 */
export function useNetworkGuard(opts?: UseNetworkGuardOptions): NetworkGuardState {
  const requiredChainId = opts?.requiredChainId;
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending, error } = useSwitchChain();
  const { isLoading: authModeLoading } = useAuthMode();
  const inFlightSwitch = useRef<Promise<void> | null>(null);

  const isWrongNetwork =
    requiredChainId != null &&
    !authModeLoading &&
    isConnected &&
    chainId !== requiredChainId;

  const requestSwitch = useCallback(
    async (targetChainId: number) => {
      if (chainId === targetChainId) return;
      if (inFlightSwitch.current) {
        await inFlightSwitch.current;
        return;
      }

      if (!switchChainAsync) {
        throw new Error(
          "This wallet cannot switch networks from the app. Switch networks in your wallet, then try again."
        );
      }

      const run = (async () => {
        const addEthereumChainParameter = addEthereumChainParameterFor(targetChainId);
        try {
          await switchChainAsync({
            chainId: targetChainId,
            ...(addEthereumChainParameter ? { addEthereumChainParameter } : {}),
          });
        } catch (err) {
          if (!isUnrecognizedChainError(err) || !addEthereumChainParameter) {
            throw err;
          }
          await switchChainAsync({
            chainId: targetChainId,
            addEthereumChainParameter,
          });
        }
      })();

      inFlightSwitch.current = run.finally(() => {
        inFlightSwitch.current = null;
      });
      await inFlightSwitch.current;
    },
    [chainId, switchChainAsync]
  );

  const switchToRequiredChain = useCallback(async () => {
    if (requiredChainId == null) return;
    await requestSwitch(requiredChainId);
  }, [requestSwitch, requiredChainId]);

  const switchToBase = useCallback(async () => {
    await requestSwitch(base.id);
  }, [requestSwitch]);

  return {
    isWrongNetwork,
    switchToBase,
    switchToRequiredChain,
    isSwitching: isPending,
    error: error ?? null,
  };
}
