"use client";

import { useReadContract } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { type Address } from "viem";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

/**
 * Chain used for the `name()` read — always explicit, never the wallet’s connected chain.
 * Only Base and Ethereum mainnet are supported; anything else falls back to app default (Base).
 */
function resolveNameReadChainId(nftChainId?: number | null): number {
  if (nftChainId === mainnet.id) return mainnet.id;
  if (nftChainId === base.id) return base.id;
  return CHAIN_ID;
}

function normalizeContractAddress(
  contractAddress: Address | string | null | undefined
): Address | undefined {
  const raw =
    typeof contractAddress === "string"
      ? contractAddress.trim()
      : contractAddress != null
        ? String(contractAddress).trim()
        : "";
  if (!raw || !/^0x[a-fA-F0-9]{40}$/i.test(raw)) return undefined;
  return raw as Address;
}

/**
 * Reads ERC-721-style `name()` on the NFT contract’s chain via wagmi (RPC from app config).
 *
 * @param contractAddress - NFT contract address
 * @param nftChainId - `1` (Ethereum) or `8453` (Base); omit for app default (Base), not the connected chain
 */
export function useContractName(
  contractAddress: Address | string | null | undefined,
  nftChainId?: number | null
) {
  const address = normalizeContractAddress(contractAddress);
  const chainId = resolveNameReadChainId(nftChainId);

  const { data: contractName, isLoading, error } = useReadContract({
    address,
    abi: CONTRACT_INFO_ABI,
    functionName: "name",
    chainId,
    query: {
      enabled: !!address,
      retry: 1,
    },
  });

  return {
    contractName: contractName as string | undefined,
    isLoading,
    error,
  };
}
