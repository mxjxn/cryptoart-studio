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
  
  // During static generation (window is undefined), provide MiniAppProvider
  // using a pattern that doesn't create React element objects
  if (typeof window === 'undefined') {
    // Return children wrapped in MiniAppProvider using a direct function call
    // This pattern avoids creating element objects during static generation
    const MiniAppProviderComponent = MiniAppProvider as any;
    return (
      <MiniAppProviderComponent
        analyticsEnabled={ANALYTICS_ENABLED}
        backButtonEnabled={true}
        returnUrl={RETURN_URL}
      >
        {safeChildren}
      </MiniAppProviderComponent>
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
