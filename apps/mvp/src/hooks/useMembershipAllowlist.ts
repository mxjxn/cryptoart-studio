import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useMemo, useState, useEffect } from "react";
import { type Address, isAddress } from "viem";
import { MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS, MEMBERSHIP_ALLOWLIST_REGISTRY_ABI } from "~/lib/contracts/membership-allowlist";

export interface AssociatedAddress {
  address: string;
  membershipHolder: string;
}

export interface UseMembershipAllowlistReturn {
  // State
  associatedAddresses: string[];
  associatedAddressesCount: bigint | undefined;
  isLoading: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  error: Error | null;
  
  // Actions
  addAssociatedAddress: (address: string) => Promise<void>;
  removeAssociatedAddress: (address: string) => Promise<void>;
  isAssociated: (address: string) => boolean;
  getMembershipHolder: (address: string) => Promise<string | null>;
  
  // Transaction status
  addTransactionHash: string | undefined;
  removeTransactionHash: string | undefined;
  isAddSuccess: boolean;
  isRemoveSuccess: boolean;
}

/**
 * Hook to manage membership allowlist (associated addresses)
 * Allows membership holders to register additional addresses that can also sell on the marketplace
 */
export function useMembershipAllowlist(): UseMembershipAllowlistReturn {
  const { address: connectedAddress, isConnected } = useAccount();
  const [associatedAddresses, setAssociatedAddresses] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Read associated addresses count for the connected wallet
  const { data: associatedCount, isLoading: isLoadingCount } = useReadContract({
    address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
    abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
    functionName: 'membershipAssociatedCount',
    args: connectedAddress ? [connectedAddress] : undefined,
    query: {
      enabled: !!connectedAddress && isConnected && MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Write contract hooks for adding/removing addresses
  const { 
    writeContract: writeAddAddress, 
    data: addHash, 
    isPending: isAdding,
    error: addError,
    reset: resetAdd,
  } = useWriteContract();

  const { 
    writeContract: writeRemoveAddress, 
    data: removeHash, 
    isPending: isRemoving,
    error: removeError,
    reset: resetRemove,
  } = useWriteContract();

  // Wait for add transaction
  const { isLoading: isWaitingAdd, isSuccess: isAddSuccess } = useWaitForTransactionReceipt({
    hash: addHash,
  });

  // Wait for remove transaction
  const { isLoading: isWaitingRemove, isSuccess: isRemoveSuccess } = useWaitForTransactionReceipt({
    hash: removeHash,
  });

  // Update error state when errors occur
  useEffect(() => {
    if (addError) {
      setError(new Error(addError.message || 'Failed to add associated address'));
    } else if (removeError) {
      setError(new Error(removeError.message || 'Failed to remove associated address'));
    } else {
      setError(null);
    }
  }, [addError, removeError]);

  // Refresh count when transactions succeed
  useEffect(() => {
    if (isAddSuccess || isRemoveSuccess) {
      // The count will auto-refresh via the useReadContract hook
      resetAdd();
      resetRemove();
    }
  }, [isAddSuccess, isRemoveSuccess, resetAdd, resetRemove]);

  /**
   * Add an associated address to the allowlist
   */
  const addAssociatedAddress = async (address: string): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!isAddress(address)) {
      throw new Error('Invalid address format');
    }

    if (address.toLowerCase() === connectedAddress.toLowerCase()) {
      throw new Error('Cannot associate your own address');
    }

    setError(null);

    try {
      writeAddAddress({
        address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
        abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
        functionName: 'addAssociatedAddress',
        args: [address as Address],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add associated address');
      setError(error);
      throw error;
    }
  };

  /**
   * Remove an associated address from the allowlist
   */
  const removeAssociatedAddress = async (address: string): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!isAddress(address)) {
      throw new Error('Invalid address format');
    }

    setError(null);

    try {
      writeRemoveAddress({
        address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
        abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
        functionName: 'removeAssociatedAddress',
        args: [address as Address],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove associated address');
      setError(error);
      throw error;
    }
  };

  /**
   * Check if an address is associated with the connected wallet's membership
   */
  const isAssociated = (address: string): boolean => {
    if (!connectedAddress || !isAddress(address)) {
      return false;
    }
    return associatedAddresses.some(
      (addr) => addr.toLowerCase() === address.toLowerCase()
    );
  };

  /**
   * Get the membership holder for an associated address
   * Note: This requires a read contract call - can be implemented if needed for UI
   */
  const getMembershipHolder = async (address: string): Promise<string | null> => {
    if (!isAddress(address)) {
      return null;
    }

    // TODO: Implement read contract call if needed
    // The marketplace contract handles authorization checks automatically
    return null;
  };

  const isLoading = isLoadingCount || isWaitingAdd || isWaitingRemove;

  return {
    associatedAddresses,
    associatedAddressesCount: associatedCount,
    isLoading,
    isAdding: isAdding || isWaitingAdd,
    isRemoving: isRemoving || isWaitingRemove,
    error,
    addAssociatedAddress,
    removeAssociatedAddress,
    isAssociated,
    getMembershipHolder,
    addTransactionHash: addHash,
    removeTransactionHash: removeHash,
    isAddSuccess,
    isRemoveSuccess,
  };
}

