import { useEffect, useState, useMemo } from "react";
import { useMiniApp } from "@neynar/react";

/**
 * Hook to detect if the app is running in a Farcaster mini-app context
 * vs a regular web3 app context.
 * 
 * @returns {boolean} true if running in Farcaster mini-app, false if regular web app
 */
export function useIsMiniApp(): boolean {
  const { context, isSDKLoaded } = useMiniApp();
  const [isMiniApp, setIsMiniApp] = useState(false);

  // Memoize the context check to prevent unnecessary re-renders
  const contextFid = useMemo(() => context?.user?.fid, [context?.user?.fid]);

  useEffect(() => {
    // Check multiple indicators that we're in a Farcaster mini-app
    // 1. Check if Neynar context is available and has user data
    if (contextFid) {
      setIsMiniApp(true);
      return;
    }

    // 2. Check for Farcaster-specific window properties (only check once)
    if (typeof window !== "undefined") {
      const hasFarcasterSDK = !!(window as any).farcaster;
      const hasFarcasterEthereum = !!(window.ethereum as any)?.isFarcaster;
      const urlHasFarcaster = window.location.href.includes("farcaster");
      
      if (hasFarcasterSDK || hasFarcasterEthereum || urlHasFarcaster) {
        setIsMiniApp(true);
        return;
      }

      // 3. Check for Farcaster Frame connector availability
      const hasFrameProvider = !!(window.ethereum as any)?.isFarcasterFrame;
      if (hasFrameProvider) {
        setIsMiniApp(true);
        return;
      }
    }

    // Only set to false if we've checked everything and SDK is loaded
    // This prevents flickering during initial load
    if (isSDKLoaded) {
      setIsMiniApp(false);
    }
  }, [contextFid, isSDKLoaded]);

  return isMiniApp;
}

