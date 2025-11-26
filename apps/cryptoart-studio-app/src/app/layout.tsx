import type { Metadata } from 'next';
import React from 'react';

import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';
import { ErrorHandler } from '~/components/ErrorHandler';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Type assertion to bridge multiple @types/react versions in monorepo
  // Using 'any' as intermediate type to bypass strict type checking between versions
  const childrenNode = children as any as React.ReactNode;
  
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
