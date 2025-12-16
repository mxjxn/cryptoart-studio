"use client";

import { TransitionLink } from "~/components/TransitionLink";
import { useState, useRef, useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useRouter } from "next/navigation";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { useEnsAvatarForAddress } from "~/hooks/useEnsAvatar";
import { ThemeToggle } from "~/components/ThemeToggle";
import { HueSlider } from "~/components/HueSlider";
import { useColorScheme } from "~/contexts/ColorSchemeContext";
import { useAdminMode } from "~/hooks/useAdminMode";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { useHasNFTAccess } from "~/hooks/useHasNFTAccess";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";

function ProfileIcon({ pfpUrl, imageError, setImageError, isMember }: { 
  pfpUrl: string | undefined; 
  imageError: boolean; 
  setImageError: (error: boolean) => void;
  isMember: boolean;
}) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
      isMember ? 'ring-2 ring-blue-500' : 'ring-2 ring-[#666666]'
    }`}>
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
        {pfpUrl && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pfpUrl}
            alt="Profile"
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          </svg>
        )}
      </div>
    </div>
  );
}

function MembershipBadge({ isMember }: { isMember: boolean }) {
  return (
    <div
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
        isMember
          ? "bg-blue-500 text-white"
          : "bg-[#666666] text-white"
      }`}
    >
      {isMember ? "member" : "free"}
    </div>
  );
}

function AdminSection() {
  const { isAdmin, isAdminModeEnabled, toggleAdminMode } = useAdminMode();
  
  if (!isAdmin) return null;
  
  return (
    <div className="border-t border-[#333333] mt-1 pt-1">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-white">Admin Mode</span>
        <button
          onClick={toggleAdminMode}
          className={`relative inline-flex h-5 w-9 items-center transition-colors ${
            isAdminModeEnabled ? 'bg-blue-500' : 'bg-[#333333]'
          }`}
          aria-label={isAdminModeEnabled ? "Disable admin mode" : "Enable admin mode"}
          aria-pressed={isAdminModeEnabled}
        >
          <span
            className={`inline-block h-3 w-3 transform bg-white transition-transform ${
              isAdminModeEnabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <TransitionLink
        href="/admin"
        className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
      >
        Admin Dashboard
      </TransitionLink>
    </div>
  );
}

export function ProfileDropdown() {
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();
  const { context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isPro, expirationDate, membershipAddress, isFarcasterWallet, loading } = useMembershipStatus();
  const isMember = isPro; // Alias for clarity
  const { mode } = useColorScheme();
  const { isAdmin } = useIsAdmin();
  const { hasAccess: hasNFTAccess, loading: isNFTLoading } = useHasNFTAccess(STP_V2_CONTRACT_ADDRESS);
  
  // User has gallery access if they're admin OR have NFT access (members)
  const hasGalleryAccess = isAdmin || hasNFTAccess;
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  
  // Resolve ENS name and avatar for address when not in mini-app context
  const shouldResolveEns = !isMiniApp && isConnected && !!address;
  const ensName = useEnsNameForAddress(address, shouldResolveEns);
  const ensAvatar = useEnsAvatarForAddress(address, shouldResolveEns);

  // Determine the profile URL based on auth mode
  // Priority: Farcaster mini-app pfp > ENS avatar > undefined
  const pfpUrl = isMiniApp
    ? context?.user?.pfpUrl
    : ensAvatar || undefined;

  // Determine if user is authenticated
  // Mini-app: check context.user exists
  // Web: check wagmi isConnected
  const isAuthenticated = isMiniApp
    ? !!context?.user
    : isConnected;

  // Get display name
  const displayName = isMiniApp
    ? context?.user?.displayName || context?.user?.username
    : address
    ? (ensName || `${address.slice(0, 6)}...${address.slice(-4)}`)
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

  // Web context: Not authenticated - show RainbowKit ConnectButton
  if (!isMiniApp && !isAuthenticated) {
    return <ConnectButton />;
  }

  // Authenticated state (mini-app or web)
  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <MembershipBadge isMember={isMember} />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        aria-label={isOpen ? "Close profile menu" : "Open profile menu"}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ProfileIcon pfpUrl={pfpUrl} imageError={imageError} setImageError={setImageError} isMember={isMember} />
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

            <TransitionLink
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
            >
              View Profile
            </TransitionLink>
            
            {hasGalleryAccess && !isNFTLoading && (
              <TransitionLink
                href="/curate"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
              >
                My Galleries
              </TransitionLink>
            )}
            
            <TransitionLink
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors"
            >
              Preferences
            </TransitionLink>
            
            {loading ? (
              <div className="px-4 py-2 text-sm text-[#999999]">
                Loading...
              </div>
            ) : isMember && expirationDate ? (
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
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/membership");
                  }}
                  className="block w-full px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors text-left"
                >
                  Renew Membership
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (isConnected) {
                    router.push("/membership");
                  } else if (openConnectModal) {
                    openConnectModal();
                  }
                }}
                className="block w-full px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors text-left border-t border-[#333333] mt-1"
              >
                Mint Membership
              </button>
            )}

            {/* Theme Toggle */}
            <div className="border-t border-[#333333] mt-1">
              <ThemeToggle />
              {/* Show hue slider when in colorful mode */}
              {mode === 'colorful' && <HueSlider />}
            </div>

            {/* Admin Section */}
            <AdminSection />

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

