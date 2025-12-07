import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';
import { Footer } from '~/components/Footer';

const mekMono = localFont({
  src: '../../public/MEK-Mono.otf',
  variable: '--font-mek-mono',
  display: 'swap',
});

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
    <html lang="en" className={mekMono.variable} style={{ background: 'var(--color-background)' }}>
      <body className="flex flex-col min-h-screen" style={{ background: 'var(--color-background)' }}>
        <Providers>
          <div className="flex-grow" style={{ background: 'var(--color-background)' }}>
            {children}
          </div>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

