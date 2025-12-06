import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage, usePublicClient } from "wagmi";
import { useMemo, useState, useEffect, useCallback } from "react";
import { type Address, isAddress, toBytes } from "viem";
import { base } from "viem/chains";
import { MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS, MEMBERSHIP_ALLOWLIST_REGISTRY_ABI } from "~/lib/contracts/membership-allowlist";

export interface AssociatedAddress {
  address: string;
  membershipHolder: string;
}

export interface PendingSignature {
  id: string;
  fid: number;
  associatedAddress: string;
  membershipHolder: string;
  signature: string;
  nonce: string; // bigint as string from API
  createdAt: string;
  expiresAt: string;
}

export interface UseMembershipAllowlistReturn {
  // State
  associatedAddresses: string[];
  associatedAddressesCount: bigint | undefined;
  isLoading: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  isSigning: boolean;
  isFetchingSignatures: boolean;
  error: Error | null;
  
  // Pending signatures from database
  pendingSignatures: PendingSignature[];
  
  // Actions
  addAssociatedAddress: (address: string) => Promise<void>;
  removeAssociatedAddress: (address: string) => Promise<void>;
  removeSelfAssociation: () => Promise<void>;
  isAssociated: (address: string) => boolean;
  getMembershipHolder: (address: string) => Promise<string | null>;
  
  // Signature flow actions
  signForAddress: (associatedAddress: string, membershipHolder: string, fid: number) => Promise<string>;
  submitWithSignature: (associatedAddress: string, signature: string) => Promise<void>;
  fetchPendingSignatures: (params: { membershipHolder?: string; fid?: number }) => Promise<void>;
  markSignatureSubmitted: (signatureId: string, transactionHash: string) => Promise<void>;
  deleteSignature: (signatureId: string) => Promise<void>;
  
  // Transaction status
  addTransactionHash: string | undefined;
  removeTransactionHash: string | undefined;
  isAddSuccess: boolean;
  isRemoveSuccess: boolean;
}

/**
 * Hook to manage membership allowlist (associated addresses)
 * Allows membership holders to register additional addresses that can also sell on the marketplace
 * 
 * SECURITY: The secure contract requires the associated address to sign a message
 * proving they consent to the association. This prevents address spoofing.
 * 
 * Flow for adding an address (Web + Mini-app):
 * 1. On WEB: Connect the wallet you want to add, do SIWF
 * 2. On WEB: Call signForAddress() to sign the consent message, stored in DB
 * 3. In MINI-APP: Connected with membership wallet, fetch pending signatures
 * 4. In MINI-APP: Call submitWithSignature() to submit the transaction
 */
export function useMembershipAllowlist(): UseMembershipAllowlistReturn {
  const { address: connectedAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const [associatedAddresses, setAssociatedAddresses] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [pendingSignatures, setPendingSignatures] = useState<PendingSignature[]>([]);
  const [isSigning, setIsSigning] = useState(false);
  const [isFetchingSignatures, setIsFetchingSignatures] = useState(false);

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

  // Sign message hook
  const { signMessageAsync } = useSignMessage();

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
      resetAdd();
      resetRemove();
    }
  }, [isAddSuccess, isRemoveSuccess, resetAdd, resetRemove]);

  /**
   * Get the nonce for an associated address from the contract
   */
  const getNonce = useCallback(async (associatedAddress: string): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    const nonce = await publicClient.readContract({
      address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
      abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
      functionName: 'nonces',
      args: [associatedAddress as Address],
    });

    return nonce;
  }, [publicClient]);

  /**
   * Get the message hash that needs to be signed from the contract
   */
  const getMessageHash = useCallback(async (
    membershipHolder: string,
    associatedAddress: string,
    nonce: bigint
  ): Promise<`0x${string}`> => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }

    const hash = await publicClient.readContract({
      address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
      abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
      functionName: 'getAssociationMessageHash',
      args: [membershipHolder as Address, associatedAddress as Address, nonce],
    });

    return hash;
  }, [publicClient]);

  /**
   * Fetch pending signatures from the database
   */
  const fetchPendingSignatures = useCallback(async (params: { 
    membershipHolder?: string; 
    fid?: number 
  }): Promise<void> => {
    setIsFetchingSignatures(true);
    try {
      const searchParams = new URLSearchParams();
      if (params.membershipHolder) {
        searchParams.set('membershipHolder', params.membershipHolder);
      }
      if (params.fid) {
        searchParams.set('fid', params.fid.toString());
      }

      const response = await fetch(`/api/allowlist/signatures?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch pending signatures');
      }

      const data = await response.json();
      setPendingSignatures(data.signatures || []);
    } catch (err) {
      console.error('Error fetching pending signatures:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch signatures'));
    } finally {
      setIsFetchingSignatures(false);
    }
  }, []);

  /**
   * Sign the consent message for associating an address
   * Must be called while the associated address wallet is connected
   * Stores the signature in the database for later submission
   * 
   * @param associatedAddress The address being associated (must be connected wallet)
   * @param membershipHolder The membership holder who will submit the transaction
   * @param fid The Farcaster ID of the user (from SIWF)
   * @returns The signature
   */
  const signForAddress = useCallback(async (
    associatedAddress: string,
    membershipHolder: string,
    fid: number
  ): Promise<string> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (connectedAddress.toLowerCase() !== associatedAddress.toLowerCase()) {
      throw new Error('Please connect the wallet you want to add to sign the consent message');
    }

    if (!isAddress(associatedAddress) || !isAddress(membershipHolder)) {
      throw new Error('Invalid address format');
    }

    setIsSigning(true);
    setError(null);

    try {
      // Get the nonce for this address
      const nonce = await getNonce(associatedAddress);
      
      // Get the message hash from the contract
      const messageHash = await getMessageHash(membershipHolder, associatedAddress, nonce);
      
      // Sign the message hash (wallet will apply EIP-191 prefix)
      const signature = await signMessageAsync({
        message: { raw: toBytes(messageHash) },
      });

      // Store signature in database
      const response = await fetch('/api/allowlist/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid,
          associatedAddress: associatedAddress.toLowerCase(),
          membershipHolder: membershipHolder.toLowerCase(),
          signature,
          nonce: nonce.toString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to store signature');
      }

      // Refresh pending signatures
      await fetchPendingSignatures({ membershipHolder, fid });

      return signature;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign message');
      setError(error);
      throw error;
    } finally {
      setIsSigning(false);
    }
  }, [connectedAddress, isConnected, getNonce, getMessageHash, signMessageAsync, fetchPendingSignatures]);

  /**
   * Submit the addAssociatedAddress transaction with a pre-signed signature
   * Must be called while the membership holder wallet is connected
   */
  const submitWithSignature = useCallback(async (
    associatedAddress: string,
    signature: string
  ): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!isAddress(associatedAddress)) {
      throw new Error('Invalid address format');
    }

    setError(null);

    try {
      writeAddAddress({
        address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
        abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
        functionName: 'addAssociatedAddress',
        args: [associatedAddress as Address, signature as `0x${string}`],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit transaction');
      setError(error);
      throw error;
    }
  }, [connectedAddress, isConnected, writeAddAddress]);

  /**
   * Mark a signature as submitted in the database
   */
  const markSignatureSubmitted = useCallback(async (
    signatureId: string,
    transactionHash: string
  ): Promise<void> => {
    try {
      await fetch('/api/allowlist/signatures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signatureId, transactionHash }),
      });

      // Remove from local state
      setPendingSignatures(prev => prev.filter(s => s.id !== signatureId));
    } catch (err) {
      console.error('Error marking signature as submitted:', err);
    }
  }, []);

  /**
   * Delete a pending signature
   */
  const deleteSignature = useCallback(async (signatureId: string): Promise<void> => {
    try {
      await fetch('/api/allowlist/signatures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signatureId }),
      });

      // Remove from local state
      setPendingSignatures(prev => prev.filter(s => s.id !== signatureId));
    } catch (err) {
      console.error('Error deleting signature:', err);
    }
  }, []);

  /**
   * Add an associated address to the allowlist
   * This is a convenience method - looks for pending signature and submits
   */
  const addAssociatedAddress = useCallback(async (address: string): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!isAddress(address)) {
      throw new Error('Invalid address format');
    }

    // Check if we have a pending signature for this address
    const pending = pendingSignatures.find(
      s => s.associatedAddress.toLowerCase() === address.toLowerCase() &&
           s.membershipHolder.toLowerCase() === connectedAddress.toLowerCase()
    );
    
    if (pending) {
      // We have a signature and the membership holder is connected - submit!
      await submitWithSignature(address, pending.signature);
      return;
    }

    // No pending signature found
    throw new Error(
      'No pending signature found for this address. ' +
      'Please sign on the web first, then submit here.'
    );
  }, [connectedAddress, isConnected, pendingSignatures, submitWithSignature]);

  /**
   * Remove an associated address from the allowlist
   */
  const removeAssociatedAddress = useCallback(async (address: string): Promise<void> => {
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
  }, [connectedAddress, isConnected, writeRemoveAddress]);

  /**
   * Remove the connected wallet's own association (self-revocation)
   */
  const removeSelfAssociation = useCallback(async (): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    setError(null);

    try {
      writeRemoveAddress({
        address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
        abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
        functionName: 'removeSelfAssociation',
        args: [],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove self association');
      setError(error);
      throw error;
    }
  }, [connectedAddress, isConnected, writeRemoveAddress]);

  /**
   * Check if an address is associated with the connected wallet's membership
   */
  const isAssociated = useCallback((address: string): boolean => {
    if (!connectedAddress || !isAddress(address)) {
      return false;
    }
    return associatedAddresses.some(
      (addr) => addr.toLowerCase() === address.toLowerCase()
    );
  }, [connectedAddress, associatedAddresses]);

  /**
   * Get the membership holder for an associated address
   */
  const getMembershipHolder = useCallback(async (address: string): Promise<string | null> => {
    if (!isAddress(address) || !publicClient) {
      return null;
    }

    try {
      const holder = await publicClient.readContract({
        address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
        abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
        functionName: 'getMembershipHolder',
        args: [address as Address],
      });

      return holder === '0x0000000000000000000000000000000000000000' ? null : holder;
    } catch (err) {
      console.error('Error getting membership holder:', err);
      return null;
    }
  }, [publicClient]);

  const isLoading = isLoadingCount || isWaitingAdd || isWaitingRemove;

  return {
    associatedAddresses,
    associatedAddressesCount: associatedCount,
    isLoading,
    isAdding: isAdding || isWaitingAdd,
    isRemoving: isRemoving || isWaitingRemove,
    isSigning,
    isFetchingSignatures,
    error,
    pendingSignatures,
    addAssociatedAddress,
    removeAssociatedAddress,
    removeSelfAssociation,
    isAssociated,
    getMembershipHolder,
    signForAddress,
    submitWithSignature,
    fetchPendingSignatures,
    markSignatureSubmitted,
    deleteSignature,
    addTransactionHash: addHash,
    removeTransactionHash: removeHash,
    isAddSuccess,
    isRemoveSuccess,
  };
}
