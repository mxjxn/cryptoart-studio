"use client";

import { useEffect } from "react";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useQuickAuth } from "~/hooks/useQuickAuth";
import { FarcasterPrompt } from "~/components/ui/FarcasterPrompt";
import { SignIn } from "~/components/ui/wallet/SignIn";

interface AuthWrapperProps {
  children: React.ReactNode;
}

/**
 * AuthWrapper component handles authentication requirements for the app.
 * 
 * This component:
 * 1. Checks if the app is running in Farcaster mini app context
 * 2. If not in Farcaster, shows FarcasterPrompt
 * 3. If in Farcaster but not authenticated, shows SignIn component
 * 4. If authenticated, renders the children
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

  // Call ready() as soon as SDK is loaded to prevent splash screen persistence
  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

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

  // If not in Farcaster context, show prompt to use Farcaster
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

  // Fallback - should not reach here
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p>Something went wrong. Please try again.</p>
      </div>
    </div>
  );
}
