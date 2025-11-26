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
    loading: () => null, // Return null during SSR/static generation to avoid React element object issues
  }
);

// Cast to any to bypass React type conflicts between @types/react versions
const WagmiProvider = WagmiProviderDynamic as any;

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // During static generation (window is undefined), skip all providers and render children directly
  // This prevents React element objects from being created during error page generation
  if (typeof window === 'undefined') {
    // During SSR/static generation, render children directly without any providers
    // Cast to any to avoid React element object issues
    return <>{children as any}</>;
  }
  
  // During client-side rendering, use all providers normally
  const safeChildren = children as any;
  
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
