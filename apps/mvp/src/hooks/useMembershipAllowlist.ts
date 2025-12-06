import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage, usePublicClient } from "wagmi";
import { useMemo, useState, useEffect, useCallback } from "react";
import { type Address, isAddress, toBytes, keccak256, encodePacked } from "viem";
import { base } from "viem/chains";
import { MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS, MEMBERSHIP_ALLOWLIST_REGISTRY_ABI } from "~/lib/contracts/membership-allowlist";

export interface AssociatedAddress {
  address: string;
  membershipHolder: string;
}

export interface PendingSignature {
  associatedAddress: string;
  membershipHolder: string;
  signature: string;
  nonce: bigint;
  timestamp: number;
}

export interface UseMembershipAllowlistReturn {
  // State
  associatedAddresses: string[];
  associatedAddressesCount: bigint | undefined;
  isLoading: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  isSigning: boolean;
  error: Error | null;
  
  // Pending signatures (for multi-wallet flow)
  pendingSignatures: Map<string, PendingSignature>;
  
  // Actions
  addAssociatedAddress: (address: string) => Promise<void>;
  removeAssociatedAddress: (address: string) => Promise<void>;
  removeSelfAssociation: () => Promise<void>;
  isAssociated: (address: string) => boolean;
  getMembershipHolder: (address: string) => Promise<string | null>;
  
  // Signature flow actions
  signForAddress: (associatedAddress: string, membershipHolder: string) => Promise<string>;
  submitWithSignature: (associatedAddress: string, signature: string) => Promise<void>;
  clearPendingSignature: (associatedAddress: string) => void;
  
  // Transaction status
  addTransactionHash: string | undefined;
  removeTransactionHash: string | undefined;
  isAddSuccess: boolean;
  isRemoveSuccess: boolean;
}

// Local storage key for pending signatures
const PENDING_SIGNATURES_KEY = 'cryptoart_pending_allowlist_signatures';

/**
 * Hook to manage membership allowlist (associated addresses)
 * Allows membership holders to register additional addresses that can also sell on the marketplace
 * 
 * SECURITY: The new secure contract requires the associated address to sign a message
 * proving they consent to the association. This prevents address spoofing.
 * 
 * Flow for adding an address:
 * 1. Connect the wallet you want to add
 * 2. Call signForAddress() to sign the consent message
 * 3. Switch to your membership wallet
 * 4. Call submitWithSignature() to submit the transaction
 */
export function useMembershipAllowlist(): UseMembershipAllowlistReturn {
  const { address: connectedAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const [associatedAddresses, setAssociatedAddresses] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [pendingSignatures, setPendingSignatures] = useState<Map<string, PendingSignature>>(new Map());
  const [isSigning, setIsSigning] = useState(false);

  // Load pending signatures from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PENDING_SIGNATURES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PendingSignature>;
        const map = new Map<string, PendingSignature>();
        
        // Filter out expired signatures (older than 1 hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        Object.entries(parsed).forEach(([key, value]) => {
          if (value.timestamp > oneHourAgo) {
            map.set(key, {
              ...value,
              nonce: BigInt(value.nonce.toString()),
            });
          }
        });
        
        setPendingSignatures(map);
      }
    } catch (err) {
      console.error('Failed to load pending signatures:', err);
    }
  }, []);

  // Save pending signatures to localStorage when they change
  useEffect(() => {
    try {
      const obj: Record<string, any> = {};
      pendingSignatures.forEach((value, key) => {
        obj[key] = {
          ...value,
          nonce: value.nonce.toString(),
        };
      });
      localStorage.setItem(PENDING_SIGNATURES_KEY, JSON.stringify(obj));
    } catch (err) {
      console.error('Failed to save pending signatures:', err);
    }
  }, [pendingSignatures]);

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
      // The count will auto-refresh via the useReadContract hook
      resetAdd();
      resetRemove();
    }
  }, [isAddSuccess, isRemoveSuccess, resetAdd, resetRemove]);

  /**
   * Get the nonce for an associated address
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
   * Get the message hash that needs to be signed
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
   * Sign the consent message for associating an address
   * Must be called while the associated address wallet is connected
   * 
   * @param associatedAddress The address being associated (must be connected wallet)
   * @param membershipHolder The membership holder who will submit the transaction
   * @returns The signature
   */
  const signForAddress = useCallback(async (
    associatedAddress: string,
    membershipHolder: string
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

      // Store the pending signature
      const pending: PendingSignature = {
        associatedAddress: associatedAddress.toLowerCase(),
        membershipHolder: membershipHolder.toLowerCase(),
        signature,
        nonce,
        timestamp: Date.now(),
      };

      setPendingSignatures(prev => {
        const next = new Map(prev);
        next.set(associatedAddress.toLowerCase(), pending);
        return next;
      });

      return signature;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign message');
      setError(error);
      throw error;
    } finally {
      setIsSigning(false);
    }
  }, [connectedAddress, isConnected, getNonce, getMessageHash, signMessageAsync]);

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

      // Clear the pending signature after submission
      setPendingSignatures(prev => {
        const next = new Map(prev);
        next.delete(associatedAddress.toLowerCase());
        return next;
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit transaction');
      setError(error);
      throw error;
    }
  }, [connectedAddress, isConnected, writeAddAddress]);

  /**
   * Clear a pending signature
   */
  const clearPendingSignature = useCallback((associatedAddress: string) => {
    setPendingSignatures(prev => {
      const next = new Map(prev);
      next.delete(associatedAddress.toLowerCase());
      return next;
    });
  }, []);

  /**
   * Add an associated address to the allowlist
   * This is a convenience method that handles the signature flow automatically
   * if the associated address is the currently connected wallet
   */
  const addAssociatedAddress = useCallback(async (address: string): Promise<void> => {
    if (!connectedAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!isAddress(address)) {
      throw new Error('Invalid address format');
    }

    // Check if we have a pending signature for this address
    const pending = pendingSignatures.get(address.toLowerCase());
    
    if (pending && pending.membershipHolder.toLowerCase() === connectedAddress.toLowerCase()) {
      // We have a signature and the membership holder is connected - submit!
      await submitWithSignature(address, pending.signature);
      return;
    }

    // If the address to add is the connected wallet, we can sign and need membership holder later
    if (address.toLowerCase() === connectedAddress.toLowerCase()) {
      throw new Error(
        'You are connected with the address you want to add. ' +
        'Please use signForAddress() with your membership holder address, ' +
        'then switch to your membership wallet and call submitWithSignature().'
      );
    }

    // If we're the membership holder trying to add a different address without a signature
    // The user needs to connect that wallet first to sign
    throw new Error(
      'To add this address, please:\n' +
      '1. Connect the wallet you want to add\n' +
      '2. Sign the consent message\n' +
      '3. Switch back to your membership wallet\n' +
      '4. Submit the transaction'
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
    error,
    pendingSignatures,
    addAssociatedAddress,
    removeAssociatedAddress,
    removeSelfAssociation,
    isAssociated,
    getMembershipHolder,
    signForAddress,
    submitWithSignature,
    clearPendingSignature,
    addTransactionHash: addHash,
    removeTransactionHash: removeHash,
    isAddSuccess,
    isRemoveSuccess,
  };
}
