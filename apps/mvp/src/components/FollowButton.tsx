"use client";

import { useState, useEffect, useMemo } from "react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { useAccount } from "wagmi";
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
  const { context } = useMiniApp();
  
  // Get all verified addresses for the current user
  const allVerifiedAddresses = useMemo(() => {
    const addresses: string[] = [];
    
    // Get verified addresses from miniapp context
    if (context?.user) {
      const user = context.user as any;
      const verifiedAddrs = user.verified_addresses;
      
      if (verifiedAddrs?.eth_addresses) {
        addresses.push(...verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase()));
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
    
    // Add connected wallet
    if (address) {
      const connectedAddrLower = address.toLowerCase();
      if (!addresses.includes(connectedAddrLower)) {
        addresses.push(connectedAddrLower);
      }
    }
    
    // Add primary wallet if not already included
    if (primaryWallet) {
      const primaryLower = primaryWallet.toLowerCase();
      if (!addresses.includes(primaryLower)) {
        addresses.push(primaryLower);
      }
    }
    
    return addresses;
  }, [context?.user, address, primaryWallet]);
  
  // Get current user address (primary one for API calls)
  const currentUserAddress = primaryWallet || 
    address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address ||
    ((context?.user as any)?.verifications?.[0] as string);
  
  // Check if user is authenticated
  const isAuthenticated = !!currentUserAddress;
  
  // Don't show button if not authenticated or trying to follow yourself
  // Check against all verified addresses to prevent self-follow
  const normalizedFollowingAddress = followingAddress.toLowerCase();
  const isSelfFollow = allVerifiedAddresses.some(addr => addr === normalizedFollowingAddress);
  const shouldShow = isAuthenticated && !isSelfFollow;
  
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

