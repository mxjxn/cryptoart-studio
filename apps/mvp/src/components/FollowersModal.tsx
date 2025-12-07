"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { FollowButton } from "./FollowButton";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";

interface FollowerUser {
  address: string;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  fid?: number | null;
  createdAt: Date;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  type: "followers" | "following";
}

export function FollowersModal({ isOpen, onClose, address, type }: FollowersModalProps) {
  const [users, setUsers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const primaryWallet = usePrimaryWallet();
  const { address: connectedAddress } = useAccount();
  const { context } = useMiniApp();
  
  // Get current user address for determining if we can show unfollow buttons
  const currentUserAddress = primaryWallet || 
    connectedAddress || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address ||
    ((context?.user as any)?.verifications?.[0] as string);
  
  const isOwnProfile = currentUserAddress?.toLowerCase() === address.toLowerCase();
  
  const fetchUsers = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === "followers" 
        ? `/api/user/${encodeURIComponent(address)}/followers?list=true`
        : `/api/user/${encodeURIComponent(address)}/following?list=true`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      const usersList = type === "followers" ? data.followers : data.following;
      setUsers(usersList || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [address, type]);
  
  useEffect(() => {
    if (isOpen && address) {
      fetchUsers();
    }
  }, [isOpen, address, fetchUsers]);
  
  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );
  
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);
  
  if (!isOpen) return null;
  
  const displayName = (user: FollowerUser) => {
    return user.displayName || 
           user.username || 
           `${user.address.slice(0, 6)}...${user.address.slice(-4)}`;
  };
  
  const userLink = (user: FollowerUser) => {
    if (user.username) {
      return `/user/${user.username}`;
    }
    return `/user/${user.address}`;
  };
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${type === "followers" ? "Followers" : "Following"} list`}
    >
      <div
        className="bg-[#1a1a1a] border border-[#333333] rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <h2 className="text-lg font-light text-white">
            {type === "followers" ? "Followers" : "Following"}
          </h2>
          <button
            onClick={onClose}
            className="text-[#999999] hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[#999999]">Loading...</p>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[#ff4444]">{error}</p>
            </div>
          )}
          
          {!loading && !error && users.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[#999999]">
                No {type === "followers" ? "followers" : "following"} yet.
              </p>
            </div>
          )}
          
          {!loading && !error && users.length > 0 && (
            <div className="divide-y divide-[#333333]">
              {users.map((user) => (
                <div
                  key={user.address}
                  className="flex items-center gap-3 p-4 hover:bg-[#222222] transition-colors"
                >
                  <Link
                    href={userLink(user)}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {user.pfpUrl ? (
                      <img
                        src={user.pfpUrl}
                        alt={displayName(user)}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {displayName(user)}
                      </p>
                      {user.username && (
                        <p className="text-sm text-[#999999] truncate">
                          @{user.username}
                        </p>
                      )}
                    </div>
                  </Link>
                  {currentUserAddress && (
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <FollowButton followingAddress={user.address} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

