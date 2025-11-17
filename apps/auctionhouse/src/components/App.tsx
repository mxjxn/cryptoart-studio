"use client";

import React, { useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { Header } from "~/components/ui/Header";
import { Footer } from "~/components/ui/Footer";
import { HomeTab, ActionsTab, ContextTab, WalletTab } from "~/components/ui/tabs";
import { USE_WALLET } from "~/lib/constants";
import { useNeynarUser } from "../hooks/useNeynarUser";

// --- Types ---
export enum Tab {
  Home = "home",
  Actions = "actions",
  Context = "context",
  Wallet = "wallet",
}

export interface AppProps {
  title?: string;
}

/**
 * App component serves as the main container for the mini app interface.
 * 
 * This component orchestrates the overall mini app experience by:
 * - Managing tab navigation and state
 * - Handling Farcaster mini app initialization
 * - Coordinating wallet and context state
 * - Providing error handling and loading states
 * - Rendering the appropriate tab content based on user selection
 * 
 * The component integrates with the Neynar SDK for Farcaster functionality
 * and Wagmi for wallet management. It provides a complete mini app
 * experience with multiple tabs for different functionality areas.
 * 
 * Features:
 * - Tab-based navigation (Home, Actions, Context, Wallet)
 * - Farcaster mini app integration
 * - Wallet connection management
 * - Error handling and display
 * - Loading states for async operations
 * 
 * @param props - Component props
 * @param props.title - Optional title for the mini app (defaults to "Neynar Starter Kit")
 * 
 * @example
 * ```tsx
 * <App title="My Mini App" />
 * ```
 */
export default function App(
  { title }: AppProps = { title: "Neynar Starter Kit" }
) {
  const [error, setError] = useState<Error | null>(null);
  const [isInFarcaster, setIsInFarcaster] = useState<boolean | null>(null);

  // --- Hooks ---
  // useMiniApp must be called unconditionally (React rules)
  const {
    isSDKLoaded,
    context,
    setInitialTab,
    setActiveTab,
    currentTab,
  } = useMiniApp();

  // Check if we're in Farcaster context
  useEffect(() => {
    // Check for Farcaster-specific window properties
    const checkFarcasterContext = () => {
      if (typeof window === 'undefined') return;
      
      const hasFarcasterSDK = 
        (window as any).farcaster || 
        (window as any).farcasterMiniApp ||
        document.querySelector('meta[name="fc:frame"]') !== null ||
        document.querySelector('meta[name="fc:miniapp"]') !== null;
      
      setIsInFarcaster(hasFarcasterSDK);
    };

    checkFarcasterContext();
  }, []);

  // --- Neynar user hook ---
  // Must call hook unconditionally (React rules)
  const { user: neynarUser, error: neynarUserError } = useNeynarUser(context || undefined);
  
  // Track errors from Neynar user hook
  useEffect(() => {
    if (neynarUserError) {
      console.error('Error fetching Neynar user:', neynarUserError);
      setError(new Error(neynarUserError));
    }
  }, [neynarUserError]);

  // --- Effects ---
  /**
   * Sets the initial tab to "home" when the SDK is loaded.
   * 
   * This effect ensures that users start on the home tab when they first
   * load the mini app. It only runs when the SDK is fully loaded to
   * prevent errors during initialization.
   */
  useEffect(() => {
    if (isSDKLoaded && setInitialTab) {
      try {
        setInitialTab(Tab.Home);
      } catch (err) {
        console.error('Error setting initial tab:', err);
      }
    }
  }, [isSDKLoaded, setInitialTab]);

  // --- Error Handling ---
  // If not in Farcaster context, show message directing users to open in Farcaster
  if (isInFarcaster === false || (error && !isSDKLoaded)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Open in Farcaster</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This mini app is designed to run inside Farcaster. Please open it from your Farcaster client (Warpcast, etc.) to use all features.
            </p>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error: {error.message}
                </p>
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 <strong>Tip:</strong> Look for this app in your Farcaster feed or search for it in your Farcaster client&apos;s mini app directory.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Early Returns ---
  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p>Loading SDK...</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  try {
    return (
      <div
        style={{
          paddingTop: context?.client?.safeAreaInsets?.top ?? 0,
          paddingBottom: context?.client?.safeAreaInsets?.bottom ?? 0,
          paddingLeft: context?.client?.safeAreaInsets?.left ?? 0,
          paddingRight: context?.client?.safeAreaInsets?.right ?? 0,
        }}
      >
        {/* Header should be full width */}
        <Header neynarUser={neynarUser} />

      {/* Main content and footer should be centered */}
      <div className="container py-2 pb-20">
        {/* Main title */}
        <h1 className="text-2xl font-bold text-center mb-4">{title}</h1>

        {/* Tab content rendering */}
        {currentTab === Tab.Home && <HomeTab />}
        {currentTab === Tab.Actions && <ActionsTab />}
        {currentTab === Tab.Context && <ContextTab />}
        {currentTab === Tab.Wallet && <WalletTab />}

        {/* Footer with navigation */}
        {React.createElement(Footer, { activeTab: currentTab as Tab, setActiveTab, showWallet: USE_WALLET })}
      </div>
    </div>
    );
  } catch (renderError) {
    console.error('Error rendering App component:', renderError);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please try opening this mini app in Farcaster. If the problem persists, try refreshing.
            </p>
            {renderError instanceof Error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Error: {renderError.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

