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
    loading: () => React.createElement('div', { className: 'flex items-center justify-center h-screen' }, React.createElement('div', { className: 'spinner h-8 w-8' })),
  }
);

// Cast to any to bypass React type conflicts between @types/react versions
const WagmiProvider = WagmiProviderDynamic as any;

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider storagePrefix="cryptoart-studio">
      <WagmiProvider>
        <MiniAppProvider
          analyticsEnabled={ANALYTICS_ENABLED}
          backButtonEnabled={true}
          returnUrl={RETURN_URL}
        >
          {children}
        </MiniAppProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
