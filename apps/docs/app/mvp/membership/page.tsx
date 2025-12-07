'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function MembershipPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Membership
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Get membership to start creating auctions. Quality curation through membership-based seller registry.
        </p>
      </div>

      {/* What is Membership */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          What is Membership?
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Membership is an STP v2 NFT (hypersub) that gives you access to create auctions on cryptoart.social. 
          The membership system ensures quality curation by requiring all sellers to hold an active membership NFT.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Think of it as your creator pass—once you have membership, you can create as many auctions as you want 
          while your membership is active.
        </p>
      </TerminalCard>

      {/* Why Membership is Required */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Why is Membership Required?
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The membership requirement serves as a quality control mechanism:
        </p>
        <ul className="space-y-2 mb-4">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Quality Curation</strong> - Ensures only serious artists create listings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Reduced Spam</strong> - Prevents low-quality or spam listings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Community Investment</strong> - Shows commitment to the platform
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Seller Registry</strong> - Creates a curated list of verified creators
          </li>
        </ul>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Note: Membership is only required for <strong>creating</strong> auctions. Anyone can bid, purchase, 
          or browse listings without membership.
        </p>
      </TerminalCard>

      {/* How to Get Membership */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          How to Get Membership
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          To get membership, you need to purchase an STP v2 NFT. Here's how:
        </p>
        <ol className="space-y-3 list-decimal list-inside mb-4">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Visit the membership page in the app
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Connect your wallet or sign in with Farcaster
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Purchase membership for 0.5 ETH
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Your membership NFT will be minted to your wallet
          </li>
        </ol>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Once you have membership, you can start creating auctions immediately. Your membership status is verified 
          on-chain, so no additional approval is needed.
        </p>
      </TerminalCard>

      {/* Membership Cost */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Membership Cost
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Membership costs <strong>0.5 ETH</strong> (one-time purchase). This gives you:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Unlimited auction creation while membership is active
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Access to all listing types (auctions, fixed price, dynamic price, offers)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Creator status and verification
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Listing in the seller registry
          </li>
        </ul>
      </TerminalCard>

      {/* Membership Benefits */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Membership Benefits
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Artists
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Create unlimited auctions
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Access all listing types
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Verified creator status
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Quality marketplace environment
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Collectors
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Curated selection of art
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Verified sellers only
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Reduced spam and low-quality listings
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • No membership required to buy
              </li>
            </ul>
          </div>
        </div>
      </TerminalCard>

      {/* Verification */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          On-Chain Verification
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Your membership status is verified on-chain using the STP v2 NFT's balance check. The marketplace contract 
          checks that you hold an active membership NFT before allowing you to create listings.
        </p>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          This means your membership is transparent, verifiable, and doesn't require any centralized approval process.
        </p>
      </TerminalCard>

      {/* Back to MVP */}
      <div className="mt-12 text-center">
        <TerminalLink href="/mvp" className="text-sm uppercase">
          ← Back to MVP Overview
        </TerminalLink>
      </div>
    </div>
  )
}


