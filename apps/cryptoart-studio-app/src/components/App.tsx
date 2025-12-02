"use client";

import { useEffect, Suspense, lazy } from "react";
import { useMiniApp } from "@neynar/react";
import { Header } from "~/components/ui/Header";
import { Footer } from "~/components/ui/Footer";
import { USE_WALLET } from "~/lib/constants";
import { useNeynarUser } from "../hooks/useNeynarUser";
import { AuthWrapper } from "~/components/AuthWrapper";

// Lazy load heavy components
const HomeTab = lazy(() => import("~/components/ui/tabs").then(m => ({ default: m.HomeTab })));
const ActionsTab = lazy(() => import("~/components/ui/tabs").then(m => ({ default: m.ActionsTab })));
const ContextTab = lazy(() => import("~/components/ui/tabs").then(m => ({ default: m.ContextTab })));
const WalletTab = lazy(() => import("~/components/ui/tabs").then(m => ({ default: m.WalletTab })));

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
  // --- Hooks ---
  const {
    isSDKLoaded,
    context,
    setInitialTab,
    setActiveTab,
    currentTab,
  } = useMiniApp();

  // --- Neynar user hook ---
  const { user: neynarUser } = useNeynarUser(context || undefined);

  // --- Effects ---
  /**
   * Sets the initial tab to "home" when the SDK is loaded.
   * 
   * This effect ensures that users start on the home tab when they first
   * load the mini app. The ready() call is now handled in AuthWrapper for better performance.
   */
  useEffect(() => {
    if (isSDKLoaded) {
      setInitialTab(Tab.Home);
    }
  }, [isSDKLoaded, setInitialTab]);


  // --- Render ---
  const isHomeTab = currentTab === Tab.Home;
  
  return (
    <AuthWrapper>
      <div
        className={`min-h-screen ${isHomeTab ? "bg-black text-white" : "bg-background text-foreground"}`}
        style={{
          paddingTop: context?.client.safeAreaInsets?.top ?? 0,
          paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
          paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
          paddingRight: context?.client.safeAreaInsets?.right ?? 0,
        }}
      >
        {/* Header should be full width - hidden on home tab */}
        {!isHomeTab && <Header neynarUser={neynarUser} />}

        {/* Main content and footer should be centered */}
        <div className={isHomeTab ? "" : "px-4 py-2 pb-20"}>
          {/* Main title - hidden on home tab */}
          {!isHomeTab && <h1 className="text-xl font-bold text-center mb-3">{title}</h1>}

          {/* Tab content rendering with Suspense */}
          <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="spinner h-6 w-6"></div></div>}>
            {currentTab === Tab.Home && <HomeTab />}
            {currentTab === Tab.Actions && <ActionsTab />}
            {currentTab === Tab.Context && <ContextTab />}
            {currentTab === Tab.Wallet && <WalletTab />}
          </Suspense>

          {/* Footer with navigation - hidden on home tab */}
          {!isHomeTab && <Footer activeTab={currentTab as Tab} setActiveTab={setActiveTab} showWallet={USE_WALLET} />}
        </div>
      </div>
    </AuthWrapper>
  );
}

