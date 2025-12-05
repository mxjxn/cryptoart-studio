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
    error,
    addAssociatedAddress,
    removeAssociatedAddress,
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
        // Fallback to local context on error
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
      } finally {
        setIsLoadingVerifiedAddresses(false);
      }
    };

    fetchVerifiedAddresses();
  }, [userFid, context?.user, farcasterProfile]);

  // Filter out the membership address and connected address from verified addresses
  const relevantVerifiedAddresses = useMemo(() => {
    return verifiedAddresses.filter((addr) => {
      const lowerAddr = addr.toLowerCase();
      const membershipLower = membershipAddress?.toLowerCase();
      
      // Only exclude the membership address itself (they already have direct access)
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

    // Check each address in parallel
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

  // Re-check status when transactions succeed (with a small delay to ensure blockchain state is updated)
  useEffect(() => {
    if (isAddSuccess || isRemoveSuccess) {
      // Wait a bit for the blockchain state to update after transaction confirmation
      const timeoutId = setTimeout(() => {
        checkStatuses();
      }, 2000); // 2 second delay to ensure state is updated

      return () => clearTimeout(timeoutId);
    }
  }, [isAddSuccess, isRemoveSuccess, checkStatuses]);

  // Get addresses that are not authorized
  const unauthorizedAddresses = useMemo(() => {
    return relevantVerifiedAddresses.filter((addr) => {
      const status = addressStatuses.get(addr.toLowerCase());
      return status && status.isAuthorized === false;
    });
  }, [relevantVerifiedAddresses, addressStatuses]);

  // Filter out the membership address and connected address from suggestions (for manual add form)
  const suggestedAddresses = useMemo(() => {
    return verifiedAddresses.filter((addr) => {
      const lowerAddr = addr.toLowerCase();
      const membershipLower = membershipAddress?.toLowerCase();
      const connectedLower = connectedAddress?.toLowerCase();
      const primaryLower = primaryWallet?.toLowerCase();
      
      return (
        lowerAddr !== membershipLower &&
        lowerAddr !== connectedLower &&
        lowerAddr !== primaryLower
      );
    });
  }, [verifiedAddresses, membershipAddress, connectedAddress, primaryWallet]);

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleAddAddress = async () => {
    if (!newAddress.trim()) {
      setAddError("Please enter an address");
      return;
    }

    if (!isAddress(newAddress)) {
      setAddError("Invalid Ethereum address format");
      return;
    }

    setAddError(null);

    try {
      await addAssociatedAddress(newAddress);
      setNewAddress("");
      setShowAddForm(false);
      // Status will be refreshed automatically when isAddSuccess becomes true
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add address");
    }
  };

  const handleRemoveAddress = async (address: string) => {
    if (!confirm(`Are you sure you want to remove ${formatAddress(address)} from your allowlist?`)) {
      return;
    }

    try {
      await removeAssociatedAddress(address);
      // Status will be refreshed automatically when isRemoveSuccess becomes true
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleAllowlistAddress = async (address: string) => {
    try {
      await addAssociatedAddress(address);
      // Status will be refreshed automatically when isAddSuccess becomes true
    } catch (err) {
      console.error('Error allowlisting address:', err);
    }
  };

  const handleAllowAll = async () => {
    if (unauthorizedAddresses.length === 0) return;
    
    // Add all unauthorized addresses one by one
    // Note: We add them sequentially to avoid nonce issues
    for (const addr of unauthorizedAddresses) {
      try {
        await addAssociatedAddress(addr);
        // Wait a bit between transactions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Error allowlisting ${addr}:`, err);
      }
    }
    // Status will be refreshed automatically when transactions succeed
  };

  // Don't show if user doesn't have membership in connected wallet
  if (!membershipAddress || !connectedAddress || !isConnected) {
    return null;
  }

  // Check if connected address matches membership address
  const isMembershipWallet = connectedAddress.toLowerCase() === membershipAddress.toLowerCase();

  if (!isMembershipWallet) {
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
          <p className="text-red-400 text-sm">
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
            {unauthorizedAddresses.length > 1 && (
              <button
                onClick={handleAllowAll}
                disabled={isAdding || isRemoving}
                className="px-3 py-1 text-xs bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Allow All ({unauthorizedAddresses.length})
              </button>
            )}
          </div>
          <div className="space-y-2">
            {relevantVerifiedAddresses.map((addr) => {
              const status = addressStatuses.get(addr.toLowerCase());
              const isAuthorized = status?.isAuthorized ?? null;
              const isLoadingStatus = status === undefined;

              return (
                <div
                  key={addr}
                  className="p-3 bg-black rounded border border-[#333333] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-sm font-mono text-white truncate">
                      {formatAddress(addr)}
                    </span>
                    {isLoadingStatus ? (
                      <span className="text-xs text-[#999999]">Checking...</span>
                    ) : isAuthorized ? (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                        Authorized
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                        Not Authorized
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAuthorized === false && (
                      <button
                        onClick={() => handleAllowlistAddress(addr)}
                        disabled={isAdding || isRemoving}
                        className="px-3 py-1 text-xs bg-white text-black font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Allowlist
                      </button>
                    )}
                    {isAuthorized === true && (
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

      {/* Manual Add Address Form (Fallback) */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={isAdding || isRemoving}
          className="w-full mb-4 px-4 py-2 bg-transparent border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:border-[#666666] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Manually Add Address
        </button>
      ) : (
        <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
          <label className="block text-sm text-[#cccccc] mb-2">
            Ethereum Address
          </label>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => {
              setNewAddress(e.target.value);
              setAddError(null);
            }}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#333333] rounded text-white text-sm font-mono mb-3 focus:outline-none focus:border-white"
          />

          {/* Suggested Addresses */}
          {suggestedAddresses.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-[#999999] mb-2">Your Farcaster Verified Addresses:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedAddresses.map((addr) => (
                  <button
                    key={addr}
                    onClick={() => {
                      setNewAddress(addr);
                      setAddError(null);
                    }}
                    className="px-3 py-1 text-xs bg-[#333333] hover:bg-[#444444] text-white rounded border border-[#555555] font-mono"
                  >
                    {formatAddress(addr)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddAddress}
              disabled={isAdding || !newAddress.trim() || !isAddress(newAddress)}
              className="flex-1 px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? "Adding..." : "Add Address"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewAddress("");
                setAddError(null);
              }}
              disabled={isAdding}
              className="px-4 py-2 bg-transparent border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:border-[#666666] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
        <p className="text-blue-400 text-xs">
          💡 <strong>Tip:</strong> Associated addresses can create listings on the marketplace as long as your membership is active. 
          You can remove addresses at any time from this wallet.
        </p>
      </div>
    </div>
  );
}

