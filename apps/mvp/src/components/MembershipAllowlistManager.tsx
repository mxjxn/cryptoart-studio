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
  isAuthorized: boolean | null;
  membershipHolder: string | null;
}

/**
 * Component for managing associated addresses (allowlist) for membership
 * 
 * SECURE FLOW (Web + Mini-app):
 * 1. On WEB: User connects the wallet they want to add
 * 2. On WEB: User does SIWF to prove their Farcaster identity
 * 3. On WEB: User signs consent message → stored in database
 * 4. In MINI-APP: User is connected with membership wallet
 * 5. In MINI-APP: Fetch pending signatures from DB and submit
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
    isFetchingSignatures,
    error,
    pendingSignatures,
    removeAssociatedAddress,
    signForAddress,
    submitWithSignature,
    fetchPendingSignatures,
    markSignatureSubmitted,
    deleteSignature,
    addTransactionHash,
    removeTransactionHash,
    isAddSuccess,
    isRemoveSuccess,
  } = useMembershipAllowlist();

  const [addError, setAddError] = useState<string | null>(null);
  const [addressStatuses, setAddressStatuses] = useState<Map<string, VerifiedAddressStatus>>(new Map());
  const [isCheckingStatuses, setIsCheckingStatuses] = useState(false);
  const [verifiedAddresses, setVerifiedAddresses] = useState<string[]>([]);
  const [isLoadingVerifiedAddresses, setIsLoadingVerifiedAddresses] = useState(false);

  // Detect if we're in a mini-app context
  const isInMiniApp = useMemo(() => {
    return !!context?.user;
  }, [context?.user]);

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
        // Fallback to local context
        const addresses: string[] = [];

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
        console.error('Error fetching verified addresses:', error);
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

  // Fetch pending signatures when membership wallet is connected
  useEffect(() => {
    if (membershipAddress && isMembershipWallet && userFid) {
      fetchPendingSignatures({ membershipHolder: membershipAddress, fid: userFid });
    }
  }, [membershipAddress, isMembershipWallet, userFid, fetchPendingSignatures]);

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

  // Initial status check
  useEffect(() => {
    checkStatuses();
  }, [checkStatuses]);

  // Re-check status when transactions succeed
  useEffect(() => {
    if (isAddSuccess || isRemoveSuccess) {
      const timeoutId = setTimeout(() => {
        checkStatuses();
        // Also refresh pending signatures
        if (membershipAddress && userFid) {
          fetchPendingSignatures({ membershipHolder: membershipAddress, fid: userFid });
        }
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isAddSuccess, isRemoveSuccess, checkStatuses, membershipAddress, userFid, fetchPendingSignatures]);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Handle signing consent for an address (when that wallet is connected on WEB)
  const handleSignConsent = async (addressToAdd: string) => {
    if (!membershipAddress || !userFid) {
      setAddError("Missing membership address or Farcaster ID");
      return;
    }

    setAddError(null);

    try {
      await signForAddress(addressToAdd, membershipAddress, userFid);
      // Success! Signature stored in DB
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to sign");
    }
  };

  // Handle submitting with a pending signature (when membership wallet is connected in MINI-APP)
  const handleSubmitWithSignature = async (addressToAdd: string, signatureId: string, signature: string) => {
    setAddError(null);

    try {
      await submitWithSignature(addressToAdd, signature);
      // Mark as submitted after transaction is sent
      if (addTransactionHash) {
        await markSignatureSubmitted(signatureId, addTransactionHash);
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to submit");
    }
  };

  // Handle marking signature as submitted when transaction confirms
  useEffect(() => {
    if (isAddSuccess && addTransactionHash) {
      // Find the pending signature that was just submitted
      pendingSignatures.forEach(async (sig) => {
        await markSignatureSubmitted(sig.id, addTransactionHash);
      });
    }
  }, [isAddSuccess, addTransactionHash, pendingSignatures, markSignatureSubmitted]);

  const handleRemoveAddress = async (address: string) => {
    if (!confirm(`Are you sure you want to remove ${formatAddress(address)} from your allowlist?`)) {
      return;
    }

    try {
      await removeAssociatedAddress(address);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const handleCancelSignature = async (signatureId: string) => {
    try {
      await deleteSignature(signatureId);
    } catch (err) {
      console.error('Error canceling signature:', err);
    }
  };

  // Don't show if user doesn't have required context
  if (!membershipAddress || !connectedAddress || !isConnected) {
    return null;
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-medium mb-1">Allowlist Management</h2>
          <p className="text-sm text-[#cccccc]">
            Register additional addresses so they can also sell on the marketplace.
          </p>
        </div>
      </div>

      {/* Context Banner */}
      {isInMiniApp && isMembershipWallet && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded">
          <p className="text-green-400 text-sm">
            ✓ You're connected with your membership wallet. You can submit pending signatures here.
          </p>
        </div>
      )}

      {!isInMiniApp && isVerifiedAddressWallet && userFid && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
          <p className="text-blue-400 text-sm">
            🔑 You're connected with a verified address. Sign to authorize it for the allowlist.
          </p>
        </div>
      )}

      {!isInMiniApp && !userFid && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
          <p className="text-yellow-400 text-sm">
            ⚠️ Sign in with Farcaster to manage your allowlist. This links your verified addresses.
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

      {/* Pending Signatures (for membership wallet in mini-app) */}
      {isMembershipWallet && pendingSignatures.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-[#cccccc] mb-3">
            Pending Signatures ({pendingSignatures.length})
          </h3>
          <div className="space-y-2">
            {pendingSignatures.map((sig) => (
              <div
                key={sig.id}
                className="p-3 bg-green-900/10 rounded border border-green-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-white">
                    {formatAddress(sig.associatedAddress)}
                  </span>
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                    Ready to Submit
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSubmitWithSignature(sig.associatedAddress, sig.id, sig.signature)}
                    disabled={isAdding}
                    className="px-3 py-1 text-xs bg-green-600 text-white font-medium tracking-[0.5px] hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAdding ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    onClick={() => handleCancelSignature(sig.id)}
                    className="px-2 py-1 text-xs text-[#999999] hover:text-white transition-colors"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Addresses List */}
      {isLoadingVerifiedAddresses ? (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">Loading verified addresses...</p>
        </div>
      ) : isCheckingStatuses && relevantVerifiedAddresses.length > 0 ? (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">Checking authorization status...</p>
        </div>
      ) : relevantVerifiedAddresses.length > 0 ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-[#cccccc] mb-3">
            Your Verified Addresses ({relevantVerifiedAddresses.length})
          </h3>
          <div className="space-y-2">
            {relevantVerifiedAddresses.map((addr) => {
              const status = addressStatuses.get(addr.toLowerCase());
              const isAuthorized = status?.isAuthorized ?? null;
              const isLoadingStatus = status === undefined;
              const isConnectedWallet = connectedAddress?.toLowerCase() === addr.toLowerCase();
              const hasPendingSignature = pendingSignatures.some(
                s => s.associatedAddress.toLowerCase() === addr.toLowerCase()
              );

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
                    ) : hasPendingSignature ? (
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
                    {isAuthorized === false && !hasPendingSignature && (
                      <>
                        {isConnectedWallet && userFid ? (
                          // This wallet is connected and we have FID - can sign
                          <button
                            onClick={() => handleSignConsent(addr)}
                            disabled={isSigning}
                            className="px-3 py-1 text-xs bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSigning ? "Signing..." : "Sign to Authorize"}
                          </button>
                        ) : isInMiniApp ? (
                          // In mini-app, can't sign - need to go to web
                          <span className="text-xs text-[#999999]">
                            Sign on web first
                          </span>
                        ) : !userFid ? (
                          // On web but no SIWF
                          <span className="text-xs text-[#999999]">
                            Sign in with Farcaster
                          </span>
                        ) : (
                          // Different wallet connected
                          <span className="text-xs text-[#999999]">
                            Connect this wallet
                          </span>
                        )}
                      </>
                    )}

                    {/* Authorized - can remove if membership wallet */}
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
      ) : userFid ? (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <p className="text-sm text-[#999999] text-center">
            No additional verified addresses found.
          </p>
        </div>
      ) : null}

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
          🔐 <strong>Secure Flow:</strong> {isInMiniApp ? (
            "Submit pending signatures here. To add new addresses, sign on the web first."
          ) : (
            "Connect the wallet you want to add, sign in with Farcaster, then sign to authorize. Submit from the mini-app."
          )}
        </p>
      </div>
    </div>
  );
}
