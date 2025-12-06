"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMiniApp } from "@neynar/react";
import { useMembershipAllowlist } from "~/hooks/useMembershipAllowlist";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { isAddress, type Address } from "viem";
import { MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS, MEMBERSHIP_ALLOWLIST_REGISTRY_ABI } from "~/lib/contracts/membership-allowlist";
import { base } from "viem/chains";

interface MembershipAllowlistManagerProps {
  membershipAddress: string | null;
}

interface VerifiedAddressStatus {
  address: string;
  isAuthorized: boolean | null; // null = loading
  membershipHolder: string | null;
}

/**
 * Component for managing associated addresses (allowlist) for membership
 * Allows membership holders to register Farcaster verified addresses so they can also sell
 * 
 * SECURE FLOW:
 * 1. User sees their Farcaster verified addresses
 * 2. To add an address, the address must sign a consent message
 * 3. Then the membership holder submits the transaction with the signature
 */
export function MembershipAllowlistManager({ membershipAddress }: MembershipAllowlistManagerProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { context } = useMiniApp();
  const { profile: farcasterProfile } = useProfile();
  const primaryWallet = usePrimaryWallet();
  const publicClient = usePublicClient({ chainId: base.id });
  const {
    associatedAddressesCount,
    isLoading,
    isAdding,
    isRemoving,
    isSigning,
    error,
    pendingSignatures,
    addAssociatedAddress,
    removeAssociatedAddress,
    signForAddress,
    submitWithSignature,
    clearPendingSignature,
    addTransactionHash,
    removeTransactionHash,
    isAddSuccess,
    isRemoveSuccess,
  } = useMembershipAllowlist();

  const [newAddress, setNewAddress] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addressStatuses, setAddressStatuses] = useState<Map<string, VerifiedAddressStatus>>(new Map());
  const [isCheckingStatuses, setIsCheckingStatuses] = useState(false);
  const [verifiedAddresses, setVerifiedAddresses] = useState<string[]>([]);
  const [isLoadingVerifiedAddresses, setIsLoadingVerifiedAddresses] = useState(false);

  // Get FID from context or profile
  const userFid = useMemo(() => {
    if (context?.user) {
      const user = context.user as any;
      return user.fid;
    }
    if (farcasterProfile) {
      const profile = farcasterProfile as any;
      return profile.fid;
    }
    return null;
  }, [context?.user, farcasterProfile]);

  // Determine if connected wallet is the membership wallet
  const isMembershipWallet = useMemo(() => {
    return connectedAddress?.toLowerCase() === membershipAddress?.toLowerCase();
  }, [connectedAddress, membershipAddress]);

  // Check if connected wallet is one of the verified addresses (but not the membership wallet)
  const isVerifiedAddressWallet = useMemo(() => {
    if (!connectedAddress || isMembershipWallet) return false;
    return verifiedAddresses.some(
      addr => addr.toLowerCase() === connectedAddress.toLowerCase()
    );
  }, [connectedAddress, verifiedAddresses, isMembershipWallet]);

  // Fetch verified addresses from Neynar API
  useEffect(() => {
    const fetchVerifiedAddresses = async () => {
      if (!userFid) {
        // Fallback to local context if no FID available
        const addresses: string[] = [];

        // Get verified addresses from miniapp context
        if (context?.user) {
          const user = context.user as any;
          const verifiedAddrs = user.verified_addresses;

          if (verifiedAddrs?.eth_addresses) {
            verifiedAddrs.eth_addresses.forEach((addr: string) => {
              const lowerAddr = addr.toLowerCase();
              if (!addresses.includes(lowerAddr)) {
                addresses.push(lowerAddr);
              }
            });
          }

          if (verifiedAddrs?.primary?.eth_address) {
            const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
            if (!addresses.includes(primaryAddr)) {
              addresses.push(primaryAddr);
            }
          }

          if (user.verifications) {
            user.verifications.forEach((addr: string) => {
              const lowerAddr = addr.toLowerCase();
              if (!addresses.includes(lowerAddr)) {
                addresses.push(lowerAddr);
              }
            });
          }

          if (user.custody_address) {
            const custodyAddr = user.custody_address.toLowerCase();
            if (!addresses.includes(custodyAddr)) {
              addresses.push(custodyAddr);
            }
          }
        }

        // Get verified addresses from Farcaster web auth profile
        if (farcasterProfile) {
          const profile = farcasterProfile as any;
          const verifiedAddrs = profile.verified_addresses;

          if (verifiedAddrs?.eth_addresses) {
            verifiedAddrs.eth_addresses.forEach((addr: string) => {
              const lowerAddr = addr.toLowerCase();
              if (!addresses.includes(lowerAddr)) {
                addresses.push(lowerAddr);
              }
            });
          }

          if (verifiedAddrs?.primary?.eth_address) {
            const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
            if (!addresses.includes(primaryAddr)) {
              addresses.push(primaryAddr);
            }
          }

          if (profile.verifications) {
            profile.verifications.forEach((addr: string) => {
              const lowerAddr = addr.toLowerCase();
              if (!addresses.includes(lowerAddr)) {
                addresses.push(lowerAddr);
              }
            });
          }

          if (profile.custody_address) {
            const custodyAddr = profile.custody_address.toLowerCase();
            if (!addresses.includes(custodyAddr)) {
              addresses.push(custodyAddr);
            }
          }
        }

        setVerifiedAddresses(addresses);
        return;
      }

      setIsLoadingVerifiedAddresses(true);
      try {
        const response = await fetch(`/api/farcaster/verified-addresses?fid=${userFid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch verified addresses: ${response.statusText}`);
        }
        const data = await response.json();
        setVerifiedAddresses(data.verifiedAddresses || []);
      } catch (error) {
        console.error('Error fetching verified addresses from Neynar API:', error);
        // Fallback handled above
        setVerifiedAddresses([]);
      } finally {
        setIsLoadingVerifiedAddresses(false);
      }
    };

    fetchVerifiedAddresses();
  }, [userFid, context?.user, farcasterProfile]);

  // Filter out the membership address from verified addresses
  const relevantVerifiedAddresses = useMemo(() => {
    return verifiedAddresses.filter((addr) => {
      const lowerAddr = addr.toLowerCase();
      const membershipLower = membershipAddress?.toLowerCase();
      return lowerAddr !== membershipLower;
    });
  }, [verifiedAddresses, membershipAddress]);

  // Check authorization status for all verified addresses
  const checkStatuses = useCallback(async () => {
    if (!membershipAddress || !publicClient || relevantVerifiedAddresses.length === 0) {
      return;
    }

    setIsCheckingStatuses(true);
    const newStatuses = new Map<string, VerifiedAddressStatus>();

    const statusPromises = relevantVerifiedAddresses.map(async (addr) => {
      try {
        const holder = await publicClient.readContract({
          address: MEMBERSHIP_ALLOWLIST_REGISTRY_ADDRESS,
          abi: MEMBERSHIP_ALLOWLIST_REGISTRY_ABI,
          functionName: 'getMembershipHolder',
          args: [addr as Address],
        });

        const isAuthorized = holder && holder.toLowerCase() === membershipAddress.toLowerCase();
        
        return {
          address: addr,
          status: {
            address: addr,
            isAuthorized,
            membershipHolder: holder && holder !== '0x0000000000000000000000000000000000000000' ? holder : null,
          },
        };
      } catch (err) {
        console.error(`Error checking status for ${addr}:`, err);
        return {
          address: addr,
          status: {
            address: addr,
            isAuthorized: false,
            membershipHolder: null,
          },
        };
      }
    });

    const results = await Promise.all(statusPromises);
    results.forEach(({ address, status }) => {
      newStatuses.set(address.toLowerCase(), status);
    });

    setAddressStatuses(newStatuses);
    setIsCheckingStatuses(false);
  }, [membershipAddress, publicClient, relevantVerifiedAddresses]);

  // Initial status check and when verified addresses change
  useEffect(() => {
    checkStatuses();
  }, [checkStatuses]);

  // Re-check status when transactions succeed
  useEffect(() => {
    if (isAddSuccess || isRemoveSuccess) {
      const timeoutId = setTimeout(() => {
        checkStatuses();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isAddSuccess, isRemoveSuccess, checkStatuses]);

  // Get addresses that need signatures (not authorized and no pending signature)
  const addressesNeedingSignature = useMemo(() => {
    return relevantVerifiedAddresses.filter((addr) => {
      const status = addressStatuses.get(addr.toLowerCase());
      const hasPending = pendingSignatures.has(addr.toLowerCase());
      return status && status.isAuthorized === false && !hasPending;
    });
  }, [relevantVerifiedAddresses, addressStatuses, pendingSignatures]);

  // Get addresses with pending signatures ready to submit
  const addressesReadyToSubmit = useMemo(() => {
    return relevantVerifiedAddresses.filter((addr) => {
      const status = addressStatuses.get(addr.toLowerCase());
      const pending = pendingSignatures.get(addr.toLowerCase());
      return status && status.isAuthorized === false && pending;
    });
  }, [relevantVerifiedAddresses, addressStatuses, pendingSignatures]);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Handle signing consent for an address (when that wallet is connected)
  const handleSignConsent = async (addressToAdd: string) => {
    if (!membershipAddress) {
      setAddError("No membership address");
      return;
    }

    setAddError(null);

    try {
      await signForAddress(addressToAdd, membershipAddress);
      // Success! User now needs to switch to membership wallet
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to sign");
    }
  };

  // Handle submitting with a pending signature (when membership wallet is connected)
  const handleSubmitWithSignature = async (addressToAdd: string) => {
    const pending = pendingSignatures.get(addressToAdd.toLowerCase());
    if (!pending) {
      setAddError("No pending signature found");
      return;
    }

    setAddError(null);

    try {
      await submitWithSignature(addressToAdd, pending.signature);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to submit");
    }
  };

  const handleRemoveAddress = async (address: string) => {
    if (!confirm(`Are you sure you want to remove ${formatAddress(address)} from your allowlist?`)) {
      return;
    }

    try {
      await removeAssociatedAddress(address);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  // Don't show if user doesn't have membership
  if (!membershipAddress || !connectedAddress || !isConnected) {
    return null;
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-medium mb-1">Allowlist Management</h2>
          <p className="text-sm text-[#cccccc]">
            Register additional addresses (like your Farcaster verified wallets) so they can also sell on the marketplace.
          </p>
        </div>
      </div>

      {/* Wallet Status Banner */}
      {!isMembershipWallet && isVerifiedAddressWallet && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
          <p className="text-blue-400 text-sm">
            🔑 You're connected with a verified address. You can sign consent to be added to the allowlist.
          </p>
        </div>
      )}

      {isMembershipWallet && addressesReadyToSubmit.length > 0 && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded">
          <p className="text-green-400 text-sm">
            ✓ You have {addressesReadyToSubmit.length} signed address{addressesReadyToSubmit.length !== 1 ? 'es' : ''} ready to add!
          </p>
        </div>
      )}

      {/* Success Messages */}
      {isAddSuccess && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded">
          <p className="text-green-400 text-sm">
            ✓ Address successfully added to allowlist
            {addTransactionHash && (
              <a
                href={`https://basescan.org/tx/${addTransactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline hover:text-green-300"
              >
                View on BaseScan
              </a>
            )}
          </p>
        </div>
      )}

      {isRemoveSuccess && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded">
          <p className="text-green-400 text-sm">
            ✓ Address successfully removed from allowlist
            {removeTransactionHash && (
              <a
                href={`https://basescan.org/tx/${removeTransactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline hover:text-green-300"
              >
                View on BaseScan
              </a>
            )}
          </p>
        </div>
      )}

      {/* Error Messages */}
      {(error || addError) && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm whitespace-pre-line">
            {(error?.message || addError) || "An error occurred"}
          </p>
        </div>
      )}

      {/* Verified Addresses List */}
      {isLoadingVerifiedAddresses ? (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">Loading verified addresses from Farcaster...</p>
        </div>
      ) : isCheckingStatuses && relevantVerifiedAddresses.length > 0 ? (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">Checking verified addresses...</p>
        </div>
      ) : relevantVerifiedAddresses.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#cccccc]">
              Verified Addresses ({relevantVerifiedAddresses.length})
            </h3>
          </div>
          <div className="space-y-2">
            {relevantVerifiedAddresses.map((addr) => {
              const status = addressStatuses.get(addr.toLowerCase());
              const isAuthorized = status?.isAuthorized ?? null;
              const isLoadingStatus = status === undefined;
              const pending = pendingSignatures.get(addr.toLowerCase());
              const isConnectedWallet = connectedAddress?.toLowerCase() === addr.toLowerCase();

              return (
                <div
                  key={addr}
                  className="p-3 bg-black rounded border border-[#333333] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-mono text-white truncate">
                      {formatAddress(addr)}
                    </span>
                    {isConnectedWallet && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded">
                        Connected
                      </span>
                    )}
                    {isLoadingStatus ? (
                      <span className="text-xs text-[#999999]">Checking...</span>
                    ) : isAuthorized ? (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                        Authorized
                      </span>
                    ) : pending ? (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                        Signed ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded">
                        Not Authorized
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Not authorized, no pending signature */}
                    {isAuthorized === false && !pending && (
                      <>
                        {isConnectedWallet ? (
                          // This wallet is connected - can sign
                          <button
                            onClick={() => handleSignConsent(addr)}
                            disabled={isSigning}
                            className="px-3 py-1 text-xs bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSigning ? "Signing..." : "Sign to Allowlist"}
                          </button>
                        ) : (
                          // Different wallet connected - show hint
                          <span className="text-xs text-[#999999]">
                            Connect this wallet to sign
                          </span>
                        )}
                      </>
                    )}

                    {/* Has pending signature, ready to submit */}
                    {isAuthorized === false && pending && (
                      <>
                        {isMembershipWallet ? (
                          // Membership wallet connected - can submit
                          <button
                            onClick={() => handleSubmitWithSignature(addr)}
                            disabled={isAdding}
                            className="px-3 py-1 text-xs bg-green-600 text-white font-medium tracking-[0.5px] hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAdding ? "Submitting..." : "Submit"}
                          </button>
                        ) : (
                          // Need to switch to membership wallet
                          <span className="text-xs text-[#999999]">
                            Switch to membership wallet to submit
                          </span>
                        )}
                        <button
                          onClick={() => clearPendingSignature(addr)}
                          className="px-2 py-1 text-xs text-[#999999] hover:text-white transition-colors"
                          title="Clear signature"
                        >
                          ✕
                        </button>
                      </>
                    )}

                    {/* Authorized - can remove */}
                    {isAuthorized === true && isMembershipWallet && (
                      <button
                        onClick={() => handleRemoveAddress(addr)}
                        disabled={isRemoving}
                        className="px-3 py-1 text-xs bg-transparent border border-[#333333] text-white font-medium tracking-[0.5px] hover:border-[#666666] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">
            No verified addresses found. Connect your Farcaster account to see verified wallets.
          </p>
        </div>
      )}

      {/* Associated Addresses Count */}
      <div className="mb-4 p-3 bg-black rounded border border-[#333333]">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#999999]">Total Associated Addresses</span>
          <span className="text-white font-medium">
            {isLoading ? "Loading..." : (associatedAddressesCount?.toString() || "0")}
          </span>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
        <p className="text-blue-400 text-xs">
          🔐 <strong>Secure Flow:</strong> To add an address, that address must sign a consent message first. 
          This prevents unauthorized address claims. Connect each wallet you want to add, sign, 
          then switch back to your membership wallet to submit.
        </p>
      </div>
    </div>
  );
}
