"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMiniApp } from "@neynar/react";
import { useMembershipAllowlist } from "~/hooks/useMembershipAllowlist";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { isAddress } from "viem";

interface MembershipAllowlistManagerProps {
  membershipAddress: string | null;
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
  const [addressToRemove, setAddressToRemove] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Get all verified addresses from Farcaster
  const verifiedAddresses = useMemo(() => {
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

    return addresses;
  }, [context?.user, farcasterProfile]);

  // Filter out the membership address and connected address from suggestions
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
      setAddressToRemove(null);
    } catch (err) {
      // Error is handled by the hook
    }
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

      {/* Associated Addresses Count */}
      <div className="mb-4 p-3 bg-black rounded border border-[#333333]">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#999999]">Associated Addresses</span>
          <span className="text-white font-medium">
            {isLoading ? "Loading..." : (associatedAddressesCount?.toString() || "0")}
          </span>
        </div>
      </div>

      {/* Add Address Form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={isAdding || isRemoving}
          className="w-full mb-4 px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Address
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

