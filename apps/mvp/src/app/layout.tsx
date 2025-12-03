import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';

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
    <html lang="en" className={mekMono.variable}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

