'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { ThemeProvider } from '@cryptoart/ui/theme';
import { ANALYTICS_ENABLED, RETURN_URL } from '~/lib/constants';
import React from 'react';

// Lazy load heavy providers
const WagmiProviderDynamic = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
    loading: () => null,
  }
);

// Cast to any to bypass React type conflicts between @types/react versions
const WagmiProvider = WagmiProviderDynamic as any;

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const safeChildren = children as any;
  
  // During static generation, render providers but ensure no element objects are created
  // The key is to ensure children are properly handled, not to skip providers
  return (
    <ThemeProvider storagePrefix="cryptoart-studio">
      {typeof window === 'undefined' ? (
        // During SSR/static generation, render MiniAppProvider directly without WagmiProvider
        <MiniAppProvider
          analyticsEnabled={ANALYTICS_ENABLED}
          backButtonEnabled={true}
          returnUrl={RETURN_URL}
        >
          {safeChildren}
        </MiniAppProvider>
      ) : (
        // During client-side rendering, use all providers
        <WagmiProvider>
          <MiniAppProvider
            analyticsEnabled={ANALYTICS_ENABLED}
            backButtonEnabled={true}
            returnUrl={RETURN_URL}
          >
            {safeChildren}
          </MiniAppProvider>
        </WagmiProvider>
      )}
    </ThemeProvider>
  );
}
