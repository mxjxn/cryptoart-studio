'use client';

import dynamic from 'next/dynamic';
import { MiniAppProvider } from '@neynar/react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { ANALYTICS_ENABLED, RETURN_URL } from '~/lib/constants';

const WagmiProvider = dynamic(() => import('~/components/providers/WagmiProvider'), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: '#0a0a0a',
          accentColorForeground: '#ffffff',
          borderRadius: 'medium',
        })}
      >
        <MiniAppProvider
          analyticsEnabled={ANALYTICS_ENABLED}
          backButtonEnabled
          returnUrl={RETURN_URL}
        >
          {children}
        </MiniAppProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
