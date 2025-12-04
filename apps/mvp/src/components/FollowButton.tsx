"use client";

import { useState, useEffect } from "react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { useAccount } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMiniApp } from "@neynar/react";

interface FollowButtonProps {
  followingAddress: string;
  className?: string;
}

export function FollowButton({ followingAddress, className = "" }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const primaryWallet = usePrimaryWallet();
  const { address } = useAccount();
  const { profile: farcasterProfile } = useProfile();
  const { context } = useMiniApp();
  
  // Get current user address
  const currentUserAddress = primaryWallet || 
    address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address ||
    ((context?.user as any)?.verifications?.[0] as string) ||
    (farcasterProfile as any)?.verified_addresses?.primary?.eth_address ||
    (farcasterProfile as any)?.custody_address ||
    ((farcasterProfile as any)?.verifications?.[0] as string);
  
  // Check if user is authenticated
  const isAuthenticated = !!currentUserAddress;
  
  // Don't show button if not authenticated or trying to follow yourself
  const shouldShow = isAuthenticated && 
    currentUserAddress.toLowerCase() !== followingAddress.toLowerCase();
  
  useEffect(() => {
    if (!shouldShow || !currentUserAddress) {
      setIsLoading(false);
      return;
    }
    
    async function checkFollowStatus() {
      try {
        const response = await fetch(
          `/api/follow?followerAddress=${encodeURIComponent(currentUserAddress)}&followingAddress=${encodeURIComponent(followingAddress)}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.following || false);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkFollowStatus();
  }, [currentUserAddress, followingAddress, shouldShow]);
  
  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUserAddress || isToggling) return;
    
    setIsToggling(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(
          `/api/follow?followerAddress=${encodeURIComponent(currentUserAddress)}&followingAddress=${encodeURIComponent(followingAddress)}`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          setIsFollowing(false);
        }
      } else {
        // Follow
        const response = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerAddress: currentUserAddress,
            followingAddress: followingAddress,
          }),
        });
        if (response.ok) {
          setIsFollowing(true);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsToggling(false);
    }
  };
  
  if (!shouldShow || isLoading) {
    return null;
  }
  
  return (
    <button
      onClick={handleToggleFollow}
      disabled={isToggling}
      className={`px-4 py-2 text-sm font-medium tracking-[0.5px] transition-colors ${
        isFollowing
          ? 'bg-[#333333] text-white hover:bg-[#444444]'
          : 'bg-white text-black hover:bg-[#e0e0e0]'
      } ${className}`}
    >
      {isToggling ? '...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

