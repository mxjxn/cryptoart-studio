import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '~/app/globals.css';
import { APP_DESCRIPTION, APP_NAME } from '~/lib/constants';
import { StudioHeader } from '~/components/StudioHeader';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
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
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <StudioHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
