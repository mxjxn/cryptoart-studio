"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";

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
  const { context } = useMiniApp();
  const { isPro, expirationDate, membershipAddress, isFarcasterWallet, loading } = useMembershipStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pfpUrl = context?.user?.pfpUrl;
  
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
                  {membershipAddress && (
                    <div>
                      Member: {formatAddress(membershipAddress)}
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
          </div>
        </div>
      )}
    </div>
  );
}

