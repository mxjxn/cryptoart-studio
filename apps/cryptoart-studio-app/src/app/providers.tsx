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
  
  // During static generation (window is undefined), provide minimal providers
  // Use React.createElement to avoid JSX creating element objects during build
  if (typeof window === 'undefined') {
    // During static generation, only provide MiniAppProvider (needed for useMiniApp hook)
    // Use React.createElement instead of JSX to avoid element object issues
    // Pass children as the third argument (props object is second)
    return React.createElement(
      MiniAppProvider as any,
      {
        analyticsEnabled: ANALYTICS_ENABLED,
        backButtonEnabled: true,
        returnUrl: RETURN_URL,
        children: safeChildren,
      } as any
    );
  }
  
  // During client-side rendering, use all providers normally
  return (
    <ThemeProvider storagePrefix="cryptoart-studio">
      <WagmiProvider>
        <MiniAppProvider
          analyticsEnabled={ANALYTICS_ENABLED}
          backButtonEnabled={true}
          returnUrl={RETURN_URL}
        >
          {safeChildren}
        </MiniAppProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
