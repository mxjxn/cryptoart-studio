'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { ThemeProvider } from '@repo/ui/theme';
import { ANALYTICS_ENABLED, RETURN_URL } from '~/lib/constants';

// Lazy load heavy providers
const WagmiProvider = dynamic(
  () => import('~/components/providers/WagmiProvider'),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen"><div className="spinner h-8 w-8"></div></div>,
  }
);

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
