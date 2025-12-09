import { useEffect, useState, useRef } from "react";

/**
 * Hook to detect if the app is running in a Farcaster mini-app context
 * vs a regular web3 app context.
 * 
 * This hook safely detects mini-app context without requiring MiniAppProvider,
 * making it safe to use in provider components that wrap MiniAppProvider.
 * 
 * @returns {boolean} true if running in Farcaster mini-app, false if regular web app
 */
export function useIsMiniApp(): boolean {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once to prevent infinite loops
    if (hasChecked.current) {
      return;
    }

    // Check multiple indicators that we're in a Farcaster mini-app
    const checkMiniAppContext = () => {
      if (typeof window === "undefined") {
        return false;
      }

      // 1. Check for Farcaster-specific window properties
      const hasFarcasterSDK = !!(window as any).farcaster;
      const hasFarcasterEthereum = !!(window.ethereum as any)?.isFarcaster;
      const urlHasFarcaster = window.location.href.includes("farcaster");
      
      if (hasFarcasterSDK || hasFarcasterEthereum || urlHasFarcaster) {
        return true;
      }

      // 2. Check for Farcaster Frame connector availability
      const hasFrameProvider = !!(window.ethereum as any)?.isFarcasterFrame;
      if (hasFrameProvider) {
        return true;
      }

      // 3. Check for Neynar SDK indicators
      const hasNeynarSDK = !!(window as any).neynar;
      if (hasNeynarSDK) {
        return true;
      }

      return false;
    };

    const result = checkMiniAppContext();
    setIsMiniApp(result);
    hasChecked.current = true;
  }, []);

  return isMiniApp;
}

