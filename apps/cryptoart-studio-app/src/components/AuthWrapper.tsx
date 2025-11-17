"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useQuickAuth } from "~/hooks/useQuickAuth";
import { useIsMiniApp } from "~/hooks/useIsMiniApp";
import { useAccount } from "wagmi";
import { FarcasterPrompt } from "~/components/ui/FarcasterPrompt";
import { SignIn } from "~/components/ui/wallet/SignIn";

interface AuthWrapperProps {
  children: React.ReactNode;
}

/**
 * AuthWrapper component handles authentication requirements for the app.
 * 
 * This component intelligently handles both Farcaster mini-app and regular web3 contexts:
 * 
 * **In Mini-App Context:**
 * - Requires Farcaster authentication via QuickAuth
 * - Uses Farcaster wallet connector
 * 
 * **In Regular Web3 Context:**
 * - Only requires wallet connection (MetaMask, Coinbase Wallet, etc.)
 * - No Farcaster authentication required
 * 
 * @param props - Component props
 * @param props.children - Content to render when authenticated
 * 
 * @example
 * ```tsx
 * <AuthWrapper>
 *   <YourAppContent />
 * </AuthWrapper>
 * ```
 */
export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isSDKLoaded, context } = useMiniApp();
  const { authenticatedUser, status } = useQuickAuth();
  const isMiniApp = useIsMiniApp();
  const { isConnected: isWalletConnected } = useAccount();

  // Call ready() as soon as SDK is loaded (only in mini-app context)
  useEffect(() => {
    if (isSDKLoaded && isMiniApp) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded, isMiniApp]);

  // In mini-app context: require Farcaster authentication
  if (isMiniApp) {
    // Show loading while SDK loads
    if (!isSDKLoaded) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="spinner h-8 w-8 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      );
    }

    // If not in Farcaster context, show prompt (shouldn't happen if isMiniApp is true)
    if (!context) {
      return <FarcasterPrompt />;
    }

    // If in Farcaster but not authenticated, show sign in
    if (status === 'unauthenticated') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <SignIn />
          </div>
        </div>
      );
    }

    // If still loading authentication, show loading
    if (status === 'loading') {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="spinner h-8 w-8 mx-auto mb-4"></div>
            <p>Authenticating...</p>
          </div>
        </div>
      );
    }

    // If authenticated, render children
    if (status === 'authenticated' && authenticatedUser) {
      return <>{children}</>;
    }
  } else {
    // In regular web3 context: only require wallet connection
    // No Farcaster authentication needed
    return <>{children}</>;
  }

  // Fallback - should not reach here
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p>Something went wrong. Please try again.</p>
      </div>
    </div>
  );
}
