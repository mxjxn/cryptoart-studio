"use client";

import { useState } from "react";
import { useConnect, useAccount, useDisconnect } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useEnsNameForAddress } from "~/hooks/useEnsName";
import { useEnsAvatarForAddress } from "~/hooks/useEnsAvatar";
import { useMiniApp } from "@neynar/react";
import { SafeSignInButton } from "~/components/SafeSignInButton";

/**
 * Unified authentication button that adapts to the context:
 * - Mini-app: Shows Farcaster user info (already authenticated via mini-app)
 * - Web: Shows options for wallet connect OR Farcaster sign-in
 */
export function AuthButton() {
  const { isMiniApp, isLoading: authModeLoading } = useAuthMode();
  const { context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated: isFarcasterAuth, profile: farcasterProfile } = useProfile();
  const [showOptions, setShowOptions] = useState(false);
  
  // Resolve ENS name and avatar for address when not logged in via Farcaster mini-app
  const shouldResolveEns = !isMiniApp && !isFarcasterAuth && isConnected && !!address;
  const ensName = useEnsNameForAddress(address, shouldResolveEns);
  const ensAvatar = useEnsAvatarForAddress(address, shouldResolveEns);

  // Loading state while detecting context
  if (authModeLoading) {
    return (
      <div className="px-4 py-2 bg-[#1a1a1a] text-[#999999] text-sm rounded">
        Loading...
      </div>
    );
  }

  // Mini-app context: User is already authenticated via Farcaster
  if (isMiniApp && context?.user) {
    return (
      <div className="flex items-center gap-2">
        {context.user.pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.user.pfpUrl}
            alt="Profile"
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-sm text-white">
          {context.user.displayName || context.user.username}
        </span>
      </div>
    );
  }

  // Web context: Show connected state or sign-in options
  if (!isMiniApp) {
    // Connected via Farcaster auth-kit
    if (isFarcasterAuth && farcasterProfile) {
      return (
        <div className="flex items-center gap-2">
          {farcasterProfile.pfpUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={farcasterProfile.pfpUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-white">
            {farcasterProfile.displayName || farcasterProfile.username}
          </span>
        </div>
      );
    }

    // Connected via wallet
    if (isConnected && address) {
      const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;
      return (
        <div className="flex items-center gap-2">
          {ensAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ensAvatar}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
          )}
          <span className="text-sm text-white">
            {displayName}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-xs text-[#999999] hover:text-white transition-colors"
          >
            Disconnect
          </button>
        </div>
      );
    }

    // Not connected: Show sign-in options
    return (
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
        >
          Sign In
        </button>

        {showOptions && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-black border border-[#333333] rounded-lg shadow-lg z-50">
            <div className="py-2">
              {/* Farcaster Sign-In */}
              <div className="px-4 py-2">
                <SafeSignInButton
                  onSuccess={({ fid, username }) => {
                    console.log("Farcaster sign-in success:", fid, username);
                    setShowOptions(false);
                  }}
                  onError={(error) => {
                    console.error("Farcaster sign-in error:", error);
                    // Error is already handled by SafeSignInButton, just log it
                  }}
                />
              </div>

              <div className="px-4 py-1">
                <div className="text-xs text-[#666666] text-center">or</div>
              </div>

              {/* Wallet Connectors */}
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setShowOptions(false);
                  }}
                  disabled={isPending}
                  className="w-full px-4 py-2 text-sm text-white hover:bg-[#1a1a1a] transition-colors text-left"
                >
                  {isPending ? "Connecting..." : `Connect ${connector.name}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for mini-app without context (shouldn't happen normally)
  return (
    <div className="px-4 py-2 bg-[#1a1a1a] text-[#999999] text-sm rounded">
      Not connected
    </div>
  );
}

