import type { Metadata } from 'next';
import { Fraunces, Sora } from 'next/font/google';
import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_DESCRIPTION, APP_NAME } from '~/lib/constants';

/** Placeholder display + UI faces — swap by changing these loaders; tokens read --font-*. */
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sora.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
