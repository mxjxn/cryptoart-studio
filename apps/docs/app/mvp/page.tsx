'use client'

import { GradientHeader } from '../../components/GradientHeader'
import { TerminalCard } from '../../components/TerminalCard'
import { TerminalLink } from '../../components/TerminalLink'

const features = [
  {
    title: 'Auctions',
    description: 'Create and bid on NFT auctions with four different listing types to suit your sales strategy.',
    href: '/mvp/auctions',
  },
  {
    title: 'Membership',
    description: 'Get membership to start creating auctions. Quality curation through membership-based seller registry.',
    href: '/mvp/membership',
  },
  {
    title: 'Profiles',
    description: 'View your created auctions, collected NFTs, and active bids. Discover artists and collectors.',
    href: '/mvp/profiles',
  },
  {
    title: 'Notifications',
    description: 'Stay informed with real-time notifications for bids, outbids, and auction endings.',
    href: '/mvp/notifications',
  },
]

export default function MVPOverview() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Cryptoart.social MVP
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          A social-first NFT marketplace and auction platform built natively for Farcaster. 
          Create auctions, place bids, and collect digital art directly within the Farcaster ecosystem.
        </p>
      </div>

      {/* What is Cryptoart.social */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          What is Cryptoart.social?
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Cryptoart.social is a Farcaster mini-app that provides a comprehensive NFT marketplace and auction platform. 
          It enables artists to create and list NFT auctions, collectors to bid and purchase digital art, and the community 
          to discover and engage with artworks directly within the Farcaster ecosystem.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Built natively for Farcaster, cryptoart.social leverages the social graph for discovery and engagement, 
          combining the power of blockchain technology with the community-driven nature of Farcaster.
        </p>
      </TerminalCard>

      {/* Key Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {features.map((feature) => (
          <TerminalCard key={feature.title} className="flex flex-col">
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              {feature.title}
            </h3>
            <p className="font-mono text-sm mb-4 flex-1" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              {feature.description}
            </p>
            <TerminalLink href={feature.href} className="text-sm uppercase">
              Learn more →
            </TerminalLink>
          </TerminalCard>
        ))}
      </div>

      {/* Core Philosophy */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-6 uppercase" style={{ color: 'var(--color-primary)' }}>
          Core Philosophy
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Social-First
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Built natively for Farcaster, leveraging the social graph for discovery and engagement. 
              Your Farcaster profile is your marketplace identity.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Artist-Centric
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Membership model ensures quality curation while supporting artists. 
              Only members can create auctions, maintaining a high-quality marketplace.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Transparent
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All transactions are on-chain, all data comes from the subgraph. 
              No hidden fees, no intermediaries.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Accessible
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Simple interface, clear pricing, straightforward auction mechanics. 
              Easy to use despite powerful features.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Getting Started */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Getting Started
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Artists
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Get membership to start creating auctions. Choose from four listing types to suit your sales strategy. 
              Create your first auction in minutes.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Collectors
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Discover unique digital art on Farcaster. Bid on auctions or buy instantly. 
              Track your collection and connect with artists and other collectors.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Quick Links */}
      <div className="mt-12">
        <TerminalCard>
          <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
            Documentation
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TerminalCard className="text-center">
              <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
                Auctions
              </div>
              <TerminalLink href="/mvp/auctions" className="text-xs mt-2 block">
                View →
              </TerminalLink>
            </TerminalCard>
            <TerminalCard className="text-center">
              <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
                Membership
              </div>
              <TerminalLink href="/mvp/membership" className="text-xs mt-2 block">
                View →
              </TerminalLink>
            </TerminalCard>
            <TerminalCard className="text-center">
              <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
                Profiles
              </div>
              <TerminalLink href="/mvp/profiles" className="text-xs mt-2 block">
                View →
              </TerminalLink>
            </TerminalCard>
            <TerminalCard className="text-center">
              <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
                Notifications
              </div>
              <TerminalLink href="/mvp/notifications" className="text-xs mt-2 block">
                View →
              </TerminalLink>
            </TerminalCard>
          </div>
          <div className="mt-6 text-center">
            <TerminalLink href="/mvp/architecture" className="text-sm uppercase" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
              Architecture →
            </TerminalLink>
          </div>
        </TerminalCard>
      </div>
    </div>
  )
}

