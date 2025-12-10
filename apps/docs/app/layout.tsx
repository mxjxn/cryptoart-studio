import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { ColorSchemeProvider } from '../contexts/ColorSchemeContext'
import { HueSlider } from '../components/HueSlider'
import { TerminalLink } from '../components/TerminalLink'
import { ThemeToggle } from '../components/ThemeToggle'

export const metadata: Metadata = {
  title: 'CryptoArt Studio - Developer Tools',
  description: 'Documentation and tools for CryptoArt Studio smart contracts and applications',
}

const navigation: Array<{ name: string; href: string; external?: boolean }> = [
  { name: 'Home', href: '/' },
  { name: 'News', href: '/news' },
  { name: 'MVP', href: '/mvp' },
  { name: 'Auctionhouse', href: '/auctionhouse' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ColorSchemeProvider>
          <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-background-gradient)' }}>
            {/* Header */}
            <header
              className="sticky top-0 z-10 border-b-2"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
              }}
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 font-mono">
                  <Link href="/" className="flex items-center space-x-3" style={{ color: 'var(--color-primary)' }}>
                    <div className="text-2xl font-bold">
                      CRYPTOART STUDIO
                    </div>
                    <div className="text-sm hidden sm:block" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                      Developer Tools
                    </div>
                  </Link>
                  
                  <nav className="hidden md:flex space-x-6">
                    {navigation.map((item) => (
                      <TerminalLink
                        key={item.name}
                        href={item.href}
                        external={item.external}
                        className="text-sm uppercase"
                      >
                        {item.name}
                      </TerminalLink>
                    ))}
                  </nav>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3">
                      <HueSlider />
                      <ThemeToggle />
                    </div>
                    <a
                      href="https://github.com/mxjxn/cryptoart-studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)' }}
                      className="hover:opacity-80 flex-shrink-0"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Mobile navigation */}
                <nav className="md:hidden pb-4 font-mono">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-4">
                        {navigation.map((item) => (
                          <TerminalLink
                            key={item.name}
                            href={item.href}
                            external={item.external}
                            className="text-sm uppercase"
                          >
                            {item.name}
                          </TerminalLink>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <HueSlider />
                      <ThemeToggle />
                    </div>
                  </div>
                </nav>
              </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
              {children}
            </main>

            {/* Footer */}
            <footer
              className="mt-12 border-t-2 py-8"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
              }}
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                  <p>
                    Built by <TerminalLink href="https://github.com/mxjxn" external>mxjxn</TerminalLink>
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </ColorSchemeProvider>
      </body>
    </html>
  )
}

