import type { Metadata } from 'next';
import React from 'react';
import dynamic from 'next/dynamic';

import '~/app/globals.css';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';
import { ErrorHandler } from '~/components/ErrorHandler';

// Dynamically import Providers to prevent it from being analyzed during static generation
// This avoids React element object creation during build
// Cast to any to bypass TypeScript issues with dynamic imports
const ProvidersDynamic = dynamic(() => import('~/app/providers').then(mod => ({ default: mod.Providers })), {
  ssr: true,
}) as any;
const Providers = ProvidersDynamic as React.ComponentType<{ children: React.ReactNode }>;

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

// Use 'any' for props to bypass React.ReactNode type conflicts between @types/react versions
export default async function RootLayout(props: any) {
  const { children } = props;
  // During static generation, ensure children are properly serialized
  // Use 'any' to bypass React element object issues during error page generation
  const childrenNode = children as any;
  
  return (
    <html lang="en">
      <body style={{ background: 'var(--color-background-gradient)' }}>
        <ErrorHandler>
          <Providers>
            {childrenNode}
          </Providers>
        </ErrorHandler>
      </body>
    </html>
  );
}
