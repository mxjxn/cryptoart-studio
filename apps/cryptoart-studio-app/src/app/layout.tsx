import type { Metadata } from 'next';
import React from 'react';

import '~/app/globals.css';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';

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
  
  // During static generation (when building), skip all client components
  // Check if we're in a build/static generation context
  const isStaticGeneration = typeof window === 'undefined' && process.env.NODE_ENV !== 'development';
  
  if (isStaticGeneration) {
    // During static generation, render children directly without any client components
    // This prevents React element objects from being created
    return (
      <html lang="en">
        <body style={{ background: 'var(--color-background-gradient)' }}>
          {childrenNode}
        </body>
      </html>
    );
  }
  
  // During runtime, use all components normally
  // Lazy load to avoid evaluation during static generation
  const { Providers } = await import('~/app/providers');
  const { ErrorHandler } = await import('~/components/ErrorHandler');
  
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
