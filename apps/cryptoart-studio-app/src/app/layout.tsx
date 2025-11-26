import type { Metadata } from 'next';

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
  return (
    <html lang="en">
      <body style={{ background: 'var(--color-background-gradient)' }}>
        <ErrorHandler>
          <Providers>
            {children as React.ReactNode}
          </Providers>
        </ErrorHandler>
      </body>
    </html>
  );
}
