'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

const listingTypes = [
  {
    name: 'Individual Auction',
    description: 'Traditional competitive bidding. Buyers place bids, and the highest bidder wins when the auction ends.',
    features: [
      'Competitive bidding with minimum increments',
      'Reserve price support',
      'Auction extensions (anti-sniping protection)',
      'Automatic bid refunds when outbid',
    ],
  },
  {
    name: 'Fixed Price',
    description: 'Direct purchase at a set price. Buyers can purchase immediately without bidding.',
    features: [
      'Instant purchase at fixed price',
      'Perfect for edition sales (ERC1155)',
      'Multiple buyers can purchase until supply runs out',
      'Auto-finalization when all items sold',
    ],
  },
  {
    name: 'Dynamic Price',
    description: 'Price changes based on sales progress. Perfect for bonding curves or Dutch auctions.',
    features: [
      'Price adjusts automatically with sales',
      'Bonding curve support',
      'Dutch auction (time-based pricing)',
      'Lazy minting support',
    ],
  },
  {
    name: 'Offers Only',
    description: 'Buyers submit offers for your NFT. You choose whether to accept, reject, or counter.',
    features: [
      'Negotiation-based sales',
      'You control the sale',
      'Multiple offers to compare',
      'Accept or reject as you choose',
    ],
  },
]

export default function AuctionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Auctions
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Create and bid on NFT auctions with four different listing types. Choose the right sales strategy for your artwork.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The marketplace supports four distinct listing types, each designed for different sales scenarios. 
          Whether you want competitive bidding, instant purchases, dynamic pricing, or negotiation-based sales, 
          cryptoart.social has the right option for you.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          All listings support both ERC721 (single items) and ERC1155 (editions) tokens, and you can accept 
          payments in ETH or any ERC20 token.
        </p>
      </TerminalCard>

      {/* Listing Types */}
      <div className="space-y-8 mb-12">
        <h2 className="text-3xl font-bold uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Listing Types
        </h2>
        
        {listingTypes.map((type) => (
          <TerminalCard key={type.name}>
            <h3 className="text-2xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              {type.name}
            </h3>
            <p className="font-mono mb-4" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              {type.description}
            </p>
            <div className="space-y-2">
              <h4 className="text-lg font-bold uppercase" style={{ color: 'var(--color-secondary)' }}>
                Features:
              </h4>
              <ul className="space-y-1">
                {type.features.map((feature, index) => (
                  <li key={index} className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                    • {feature}
                  </li>
                ))}
              </ul>
            </div>
          </TerminalCard>
        ))}
      </div>

      {/* Creating an Auction */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Creating an Auction
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          To create an auction, you need membership (STP v2 NFT). Once you have membership, you can:
        </p>
        <ol className="space-y-3 list-decimal list-inside">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Select your NFT token (ERC721 or ERC1155)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Choose a listing type that fits your sales strategy
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Configure pricing (reserve price, fixed price, or dynamic pricing)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Set timing (start and end times)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Choose payment method (ETH or ERC20 token)
          </li>
        </ol>
        <p className="font-mono mt-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Your NFT will be transferred to the marketplace contract and held in escrow until the sale completes or you cancel.
        </p>
      </TerminalCard>

      {/* Bidding */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Bidding & Purchasing
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Placing Bids
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              For auction listings, you can place bids on active auctions. Your bid must meet the minimum increment 
              above the current highest bid. When you place a new bid, your previous bid (if any) is automatically refunded.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Instant Purchase
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              For fixed price listings, you can purchase immediately at the set price. No bidding required—just 
              confirm the transaction and the NFT is yours.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Submitting Offers
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              For offers-only listings, you can submit an offer with your desired price. The seller can accept, 
              reject, or counter your offer. You'll receive notifications when the seller responds.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Payment Options */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Payment Options
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Sellers can choose to accept payments in:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>ETH</strong> - Native Ethereum currency
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>ERC20 tokens</strong> - Any ERC20 token supported by the marketplace
          </li>
        </ul>
        <p className="font-mono mt-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          All payments are processed on-chain with automatic royalty distribution to creators.
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


