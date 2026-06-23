'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

interface AuthModeState {
  isMiniApp: boolean;
  isLoading: boolean;
}

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
      } catch {
        if (mounted) {
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
