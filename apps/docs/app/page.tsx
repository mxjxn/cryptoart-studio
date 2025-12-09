'use client'

import { GradientHeader } from '../components/GradientHeader'
import { TerminalCard } from '../components/TerminalCard'
import { TerminalLink } from '../components/TerminalLink'

interface FeatureCard {
  title: string
  description: string
  docsUrl: string
}

const mvpFeatures: FeatureCard[] = [
  {
    title: 'Auctions',
    description: 'Create and bid on NFT auctions with four listing types: Individual Auction, Fixed Price, Dynamic Price, and Offers Only.',
    docsUrl: '/mvp/auctions',
  },
  {
    title: 'Featured Sections',
    description: 'Homepage features curated carousel and dynamic featured sections showcasing selected artworks and collections.',
    docsUrl: '/mvp/featured-sections',
  },
  {
    title: 'Curation & Galleries',
    description: 'Create and publish curated galleries of listings. Admins can organize collections and feature them on the homepage.',
    docsUrl: '/mvp/curation',
  },
  {
    title: 'Social Features',
    description: 'Follow artists and collectors, favorite listings, and discover new artworks through social connections.',
    docsUrl: '/mvp/social',
  },
  {
    title: 'Membership',
    description: 'Membership-based seller registry ensures quality curation. Subscribe to STP v2 NFT to start creating auctions.',
    docsUrl: '/mvp/membership',
  },
  {
    title: 'Profiles',
    description: 'View your created auctions, collected NFTs, active bids, favorites, and galleries. Discover artists and collectors.',
    docsUrl: '/mvp/profiles',
  },
  {
    title: 'Market',
    description: 'Browse the marketplace with advanced filtering, search, and discovery tools to find the perfect artwork.',
    docsUrl: '/mvp/market',
  },
  {
    title: 'Notifications',
    description: 'Stay informed with real-time notifications for new bids, outbid alerts, and auction ending reminders.',
    docsUrl: '/mvp/notifications',
  },
  {
    title: 'Settings',
    description: 'Customize your notification preferences and manage your account settings.',
    docsUrl: '/mvp/settings',
  },
  {
    title: 'Share',
    description: 'Share your auction moments with beautiful OG images. Share when you create auctions, place bids, or win auctions.',
    docsUrl: '/mvp/share',
  },
]

const smartContractFeatures: FeatureCard[] = [
  {
    title: 'Listing Types',
    description: 'Support for auctions, fixed-price sales, dynamic pricing, and offers-only listings with flexible configuration options.',
    docsUrl: '/auctionhouse/capabilities',
  },
  {
    title: 'Token Support',
    description: 'Full support for ERC721 and ERC1155 tokens, with lazy minting capabilities and dynamic pricing engines.',
    docsUrl: '/auctionhouse/capabilities',
  },
  {
    title: 'Payment Options',
    description: 'Accept native ETH or any ERC20 token payments, with automatic royalty distribution and revenue splitting.',
    docsUrl: '/auctionhouse/capabilities',
  },
]

const deployedContracts = [
  {
    name: 'Auctionhouse Marketplace',
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',
    chain: 'Base',
  },
]

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <GradientHeader className="text-5xl md:text-6xl">
          CryptoArt Marketplace & Smart Contracts
        </GradientHeader>
        <p className="text-lg font-mono" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          A social-first NFT marketplace built for Farcaster with powerful smart contract capabilities
        </p>
      </div>

      {/* MVP Marketplace Section */}
      <div>
        <h2 className="text-3xl font-bold mb-6 uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          MVP Marketplace
        </h2>
        <TerminalCard className="mb-6">
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
            Cryptoart.social is a Farcaster mini-app that provides a comprehensive NFT marketplace and auction platform. 
            It enables artists to create and list NFT auctions, collectors to bid and purchase digital art, and the community 
            to discover and engage with artworks directly within the Farcaster ecosystem.
          </p>
          <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
            Built natively for Farcaster with membership-based curation, real-time bidding, featured sections, curation galleries, 
            social features (follows and favorites), and seamless social integration.
          </p>
        </TerminalCard>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {mvpFeatures.map((feature) => (
            <TerminalCard key={feature.title} className="flex flex-col">
              <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
                {feature.title}
              </h3>
              <p className="font-mono text-sm mb-4 flex-1" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                {feature.description}
              </p>
              <TerminalLink
                href={feature.docsUrl}
                className="text-sm uppercase"
              >
                Learn more →
              </TerminalLink>
            </TerminalCard>
          ))}
        </div>

        <div className="text-center">
          <TerminalLink
            href="/mvp"
            className="text-lg uppercase font-bold"
          >
            View MVP Documentation →
          </TerminalLink>
        </div>
      </div>

      {/* Smart Contracts Section */}
      <div>
        <h2 className="text-3xl font-bold mb-6 uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Smart Contracts
        </h2>
        <TerminalCard className="mb-6">
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
            The Auctionhouse Contracts provide a comprehensive marketplace system for selling NFTs and digital assets. 
            A fork of Manifold Gallery auctionhouse contracts, enhanced for the Cryptoart channel on Farcaster with 
            membership-based seller registry.
          </p>
          <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
            All contracts are deployed on Base Mainnet and ready for integration.
          </p>
        </TerminalCard>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {smartContractFeatures.map((feature) => (
            <TerminalCard key={feature.title} className="flex flex-col">
              <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
                {feature.title}
              </h3>
              <p className="font-mono text-sm mb-4 flex-1" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                {feature.description}
              </p>
              <TerminalLink
                href={feature.docsUrl}
                className="text-sm uppercase"
              >
                Learn more →
              </TerminalLink>
            </TerminalCard>
          ))}
        </div>

        <div className="text-center">
          <TerminalLink
            href="/auctionhouse"
            className="text-lg uppercase font-bold"
          >
            View Smart Contract Documentation →
          </TerminalLink>
        </div>
      </div>

      {/* Deployed Contracts */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
          Deployed Contracts
        </h2>
        <div className="space-y-3">
          {deployedContracts.map((contract) => (
            <div
              key={contract.address}
              className="flex items-center justify-between p-3 border-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <div className="font-semibold uppercase text-sm" style={{ color: 'var(--color-primary)' }}>
                  {contract.name}
                </div>
                <div className="text-xs font-mono" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                  {contract.chain}
                </div>
              </div>
              <TerminalLink
                href={`https://basescan.org/address/${contract.address}`}
                external
                className="text-xs font-mono"
              >
                {contract.address}
              </TerminalLink>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Quick Links */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
          Quick Links
        </h2>
        <div className="grid md:grid-cols-1 gap-4">
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              GitHub Repository
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              View source code
            </div>
            <TerminalLink href="https://github.com/mxjxn/cryptoart-monorepo" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
        </div>
      </TerminalCard>
      </div>
    </div>
  )
}
