"use client";

import { useEffect, useState } from "react";
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
  const [authTimeout, setAuthTimeout] = useState(false);

  // Call ready() as soon as SDK is loaded (only in mini-app context)
  useEffect(() => {
    if (isSDKLoaded && isMiniApp) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded, isMiniApp]);

  // Add timeout for authentication check to prevent infinite loading
  useEffect(() => {
    if (status === 'loading') {
      const timeout = setTimeout(() => {
        console.warn('Authentication check is taking too long, allowing access');
        setAuthTimeout(true);
      }, 8000); // 8 second timeout
      return () => clearTimeout(timeout);
    } else {
      setAuthTimeout(false);
    }
  }, [status]);

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

    // If still loading authentication, show loading (with timeout fallback)
    if (status === 'loading' && !authTimeout) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="spinner h-8 w-8 mx-auto mb-4"></div>
            <p>Authenticating...</p>
          </div>
        </div>
      );
    }

    // If authenticated or timeout occurred, render children
    if (status === 'authenticated' && authenticatedUser) {
      return <>{children}</>;
    }

    // If timeout occurred, allow access anyway (for development/testing)
    if (authTimeout) {
      console.warn('Authentication timeout - allowing access for development');
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
