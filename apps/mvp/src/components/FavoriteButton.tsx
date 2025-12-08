"use client";

import { useState, useEffect } from "react";
import { usePrimaryWallet } from "~/hooks/usePrimaryWallet";
import { useAccount } from "wagmi";
import { useMiniApp } from "@neynar/react";

interface FavoriteButtonProps {
  listingId: string;
  className?: string;
}

export function FavoriteButton({ listingId, className = "" }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [showSavedChip, setShowSavedChip] = useState(false);
  const primaryWallet = usePrimaryWallet();
  const { address } = useAccount();
  const { context } = useMiniApp();
  
  // Get current user address
  const currentUserAddress = primaryWallet || 
    address || 
    (context?.user as any)?.verified_addresses?.primary?.eth_address ||
    (context?.user as any)?.custody_address ||
    ((context?.user as any)?.verifications?.[0] as string);
  
  // Check if user is authenticated
  const isAuthenticated = !!currentUserAddress;
  
  useEffect(() => {
    if (!isAuthenticated || !currentUserAddress) {
      setIsLoading(false);
      return;
    }
    
    async function checkFavoriteStatus() {
      try {
        const response = await fetch(
          `/api/favorite?userAddress=${encodeURIComponent(currentUserAddress)}&listingId=${encodeURIComponent(listingId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsFavorited(data.favorited || false);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkFavoriteStatus();
  }, [currentUserAddress, listingId, isAuthenticated]);
  
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUserAddress || isToggling) return;
    
    setIsToggling(true);
    try {
      if (isFavorited) {
        // Unfavorite
        const response = await fetch(
          `/api/favorite?userAddress=${encodeURIComponent(currentUserAddress)}&listingId=${encodeURIComponent(listingId)}`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          setIsFavorited(false);
        }
      } else {
        // Favorite
        const response = await fetch('/api/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: currentUserAddress,
            listingId: listingId,
          }),
        });
        if (response.ok) {
          setIsFavorited(true);
          // Show "saved!" chip
          setShowSavedChip(true);
          setTimeout(() => setShowSavedChip(false), 2000);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsToggling(false);
    }
  };
  
  if (!isAuthenticated || isLoading) {
    return null;
  }
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleToggleFavorite}
        disabled={isToggling}
        className="w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorited}
        aria-busy={isToggling}
      >
        <span className={`text-lg ${isFavorited ? 'text-yellow-400' : 'text-white'}`} aria-hidden="true">
          ⭐️
        </span>
      </button>
      {showSavedChip && (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-white text-black text-xs font-medium rounded whitespace-nowrap animate-[fadeIn_0.2s_ease-in_forwards]">
          saved!
        </div>
      )}
    </div>
  );
}

