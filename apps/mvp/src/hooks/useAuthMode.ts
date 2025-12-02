"use client";

import { useState, useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";

interface AuthModeState {
  isMiniApp: boolean;
  isLoading: boolean;
}

/**
 * Hook to detect if the app is running in a Farcaster mini-app context
 * vs a regular web browser context.
 * 
 * Uses the official Farcaster SDK's isInMiniApp() method for reliable detection.
 * 
 * @returns {AuthModeState} Object containing:
 *   - isMiniApp: true if running in Farcaster mini-app, false if regular web
 *   - isLoading: true while detection is in progress
 */
export function useAuthMode(): AuthModeState {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function detectContext() {
      try {
        const result = await sdk.isInMiniApp();
        if (mounted) {
          setIsMiniApp(result);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error detecting mini-app context:", error);
        if (mounted) {
          // Default to false (web context) on error
          setIsMiniApp(false);
          setIsLoading(false);
        }
      }
    }

    detectContext();

    return () => {
      mounted = false;
    };
  }, []);

  return { isMiniApp, isLoading };
}

