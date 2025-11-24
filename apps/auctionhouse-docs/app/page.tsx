'use client'

import { GradientHeader } from '../components/GradientHeader'
import { TerminalCard } from '../components/TerminalCard'
import { TerminalLink } from '../components/TerminalLink'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Auctionhouse Contracts
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Comprehensive marketplace system for selling NFTs and digital assets. 
          A fork of Manifold Gallery auctionhouse contracts, enhanced for the 
          Cryptoart channel on Farcaster.
        </p>
      </div>

      {/* Key Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        <TerminalCard title="LISTING TYPES">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Support for auctions, fixed-price sales, dynamic pricing, and offers-only listings 
            with flexible configuration options.
          </p>
          <TerminalLink href="/capabilities" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="TOKEN SUPPORT">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Full support for ERC721 and ERC1155 tokens, with lazy minting capabilities 
            and dynamic pricing engines.
          </p>
          <TerminalLink href="/capabilities" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="PAYMENT OPTIONS">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Accept native ETH or any ERC20 token payments, with automatic royalty 
            distribution and revenue splitting.
          </p>
          <TerminalLink href="/capabilities" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="INTEGRATION GUIDE">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Step-by-step guide for integrating with Creator Core contracts, including 
            lazy minting and dynamic pricing setup.
          </p>
          <TerminalLink href="/integration" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="DEPLOYMENT">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Complete deployment guide for local development (Anvil) and Base Sepolia testnet, 
            with configuration instructions.
          </p>
          <TerminalLink href="/deployment" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="EXAMPLES">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Example contracts and use cases including bonding curves, Dutch auctions, 
            and lazy minting patterns.
          </p>
          <TerminalLink href="/examples" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>
      </div>

      {/* Quick Links */}
      <TerminalCard className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
          Quick Links
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              GitHub Repository
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              View source code
            </div>
            <TerminalLink href="https://github.com/mxjxn/cryptoart-monorepo/tree/main/packages/auctionhouse-contracts" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
          
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              Manifold Gallery
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Original implementation
            </div>
            <TerminalLink href="https://gallery.manifold.xyz" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
          
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              Cryptoart Channel
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Farcaster channel
            </div>
            <TerminalLink href="https://warpcast.com/~/channel/cryptoart" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
          
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              Getting Started
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Quick start guide
            </div>
            <TerminalLink href="/getting-started" className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
        </div>
      </TerminalCard>

      {/* Key Differences */}
      <div className="mt-16">
        <TerminalCard className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
            Key Difference from Original
          </h2>
          <div className="space-y-6">
            <div className="border-l-4 pl-6" style={{ borderColor: 'var(--color-secondary)' }}>
              <h3 className="text-xl font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
                Membership-Based Seller Registry
              </h3>
              <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                The seller registry is linked to active hypersub membership (STP v2 NFT's `balanceOf` 
                function returns time-remaining), enabling time-based seller authorization.
              </p>
            </div>
          </div>
        </TerminalCard>
      </div>

      {/* Attribution */}
      <div className="mt-16 text-center">
        <TerminalCard className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
            Attribution
          </h2>
          <div className="grid md:grid-cols-2 gap-8 text-left">
            <div>
              <h3 className="font-bold text-lg mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
                From Manifold Gallery
              </h3>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                <li>• Original auctionhouse contracts</li>
                <li>• Marketplace architecture & design</li>
                <li>• Security patterns & testing</li>
                <li>• Core marketplace functionality</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
                From mxjxn
              </h3>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                <li>• Membership seller registry</li>
                <li>• Documentation site</li>
                <li>• Integration examples</li>
                <li>• Deployment scripts</li>
              </ul>
            </div>
          </div>
        </TerminalCard>
      </div>
    </div>
  )
}

