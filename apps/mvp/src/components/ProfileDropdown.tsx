"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useProfile, SignInButton } from "@farcaster/auth-kit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useAuthMode } from "~/hooks/useAuthMode";

function ProfileIcon({ pfpUrl, imageError, setImageError }: { 
  pfpUrl: string | undefined; 
  imageError: boolean; 
  setImageError: (error: boolean) => void;
}) {
  return (
    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
      {pfpUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pfpUrl}
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      )}
    </div>
  );
}

function MembershipBadge({ isPro }: { isPro: boolean }) {
  return (
    <div
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
        isPro
          ? "bg-blue-500 text-white"
          : "bg-[#666666] text-white"
      }`}
    >
      {isPro ? "pro" : "free"}
    </div>
  );
}

export function ProfileDropdown() {
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();
  const { context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated: isFarcasterAuth, profile: farcasterProfile } = useProfile();
  const { isPro, expirationDate, membershipAddress, isFarcasterWallet, loading } = useMembershipStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [showSignInOptions, setShowSignInOptions] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine the profile URL based on auth mode
  const pfpUrl = isMiniApp
    ? context?.user?.pfpUrl
    : isFarcasterAuth
    ? farcasterProfile?.pfpUrl
    : undefined;

  // Determine if user is authenticated
  const isAuthenticated = isMiniApp
    ? !!context?.user
    : isFarcasterAuth || isConnected;

  // Get display name
  const displayName = isMiniApp
    ? context?.user?.displayName || context?.user?.username
    : isFarcasterAuth
    ? farcasterProfile?.displayName || farcasterProfile?.username
    : address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : undefined;
  
  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Loading state
  if (authModeLoading) {
    return (
      <div className="px-4 py-2 bg-[#1a1a1a] text-[#999999] text-sm rounded">
        Loading...
      </div>
    );
  }

  // Web context: Not authenticated - show sign-in button
  if (!isMiniApp && !isAuthenticated) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowSignInOptions(!showSignInOptions)}
          className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
        >
          Sign In
        </button>

        {showSignInOptions && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-black border border-[#333333] rounded-lg shadow-lg z-50">
            <div className="py-2">
              {/* Farcaster Sign-In */}
              <div className="px-4 py-2 border-b border-[#333333]">
                <div className="text-xs text-[#999999] mb-2">Sign in with Farcaster</div>
                <SignInButton
                  onSuccess={() => {
                    setShowSignInOptions(false);
                  }}
                />
              </div>

              {/* Wallet Connectors */}
              <div className="px-4 py-2">
                <div className="text-xs text-[#999999] mb-2">Or connect wallet</div>
                {connectors
                  .filter((c) => c.name !== "Farcaster Frame")
                  .map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => {
                        connect({ connector });
                        setShowSignInOptions(false);
                      }}
                      disabled={isConnectPending}
                      className="w-full py-2 text-sm text-white hover:text-[#cccccc] transition-colors text-left"
                    >
                      {isConnectPending ? "Connecting..." : connector.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Authenticated state (mini-app or web)
  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <MembershipBadge isPro={isPro} />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
      >
        <ProfileIcon pfpUrl={pfpUrl} imageError={imageError} setImageError={setImageError} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-black border border-[#333333] rounded-lg shadow-lg z-50">
          <div className="py-2">
            {/* Display name header for web users */}
            {!isMiniApp && displayName && (
              <div className="px-4 py-2 text-sm text-white border-b border-[#333333]">
                {displayName}
              </div>
            )}

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
            >
              View Profile
            </Link>
            
            {loading ? (
              <div className="px-4 py-2 text-sm text-[#999999]">
                Loading...
              </div>
            ) : isPro && expirationDate ? (
              <>
                <div className="px-4 py-2 text-xs text-[#999999] border-t border-[#333333] mt-1 pt-2 space-y-1">
                  <div>Expires: {formatDate(expirationDate)}</div>
                  {(() => {
                    const now = new Date();
                    const diff = expirationDate.getTime() - now.getTime();
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    
                    let timeRemaining = '';
                    if (days > 0) {
                      timeRemaining = `${days} day${days !== 1 ? 's' : ''}`;
                    } else if (hours > 0) {
                      timeRemaining = `${hours} hour${hours !== 1 ? 's' : ''}`;
                    } else {
                      timeRemaining = 'Less than 1 hour';
                    }
                    
                    return <div className="text-white">Time remaining: {timeRemaining}</div>;
                  })()}
                  {membershipAddress && (
                    <div>
                      Wallet: {formatAddress(membershipAddress)}
                    </div>
                  )}
                </div>
                {!isFarcasterWallet && membershipAddress && (
                  <a
                    href="https://hypersub.xyz/s/cryptoart"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-2 text-sm text-blue-400 hover:bg-[#1a1a1a] transition-colors border-t border-[#333333]"
                  >
                    Manage on Hypersub →
                  </a>
                )}
                <Link
                  href="/membership"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
                >
                  Renew Membership
                </Link>
              </>
            ) : (
              <Link
                href="/membership"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors border-t border-[#333333] mt-1"
              >
                Mint Membership
              </Link>
            )}

            {/* Disconnect option for web users */}
            {!isMiniApp && isConnected && (
              <button
                onClick={() => {
                  disconnect();
                  setIsOpen(false);
                }}
                className="block w-full px-4 py-2 text-sm text-[#ff6b6b] hover:bg-[#1a1a1a] transition-colors text-left border-t border-[#333333] mt-1"
              >
                Disconnect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

