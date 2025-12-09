'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function SharePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Share Functionality
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Share your auction moments with beautiful OG images. Share when you create auctions, place bids, or win auctions.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The share functionality allows you to share important auction moments with beautiful, automatically generated 
          Open Graph (OG) images. Each share generates a unique image with artwork preview, auction details, and branding.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Shareable moments are designed to be visually appealing and informative, making them perfect for sharing 
          on social media, in Farcaster casts, or anywhere else you want to showcase your auction activity.
        </p>
      </TerminalCard>

      {/* Share Types */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Share Types
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              Auction Created
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share when you create a new listing. The OG image shows:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Artwork preview
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Listing type and details
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Starting price or reserve
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Auction end time
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              Bid Placed
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share when you place a bid on an auction. The OG image shows:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Artwork preview
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Your bid amount
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Current auction status
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Time remaining
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              Top Bid
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share when you're the highest bidder. The OG image shows:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Artwork preview
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Your leading bid amount
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • "Top Bid" indicator
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Auction details
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              Being Outbid
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share when you get outbid on an auction. The OG image shows:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Artwork preview
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • New highest bid amount
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • "Outbid" indicator
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Call to action to place a new bid
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
              Auction Won
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share when you win an auction. The OG image shows:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Artwork preview
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Winning bid amount
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • "Auction Won" indicator
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Celebration styling
              </li>
            </ul>
          </div>
        </div>
      </TerminalCard>

      {/* OG Image Generation */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          OG Image Generation
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Each share generates a beautiful Open Graph image that includes:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Artwork Preview</strong> - High-quality image of the NFT artwork
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Auction Details</strong> - Listing type, price, time remaining, etc.
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Context Information</strong> - Share type, bid amount, status indicators
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Branding</strong> - Cryptoart.social branding and styling
          </li>
        </ul>
        <p className="font-mono mt-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          OG images are automatically generated server-side and cached for performance. They're optimized for social 
          media sharing and look great when shared on Farcaster, Twitter, or other platforms.
        </p>
      </TerminalCard>

      {/* How to Share */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          How to Share
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Sharing is integrated throughout the app:
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              From Listing Pages
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              After creating a listing, placing a bid, or winning an auction, you'll see share buttons or prompts 
              to share your moment. Click to generate and copy the share URL.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Share URLs
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Each share has a unique URL that displays the OG image when shared. Copy the URL and paste it anywhere 
              you want to share your auction moment.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Farcaster Integration
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Share URLs work perfectly in Farcaster casts. When you paste a share URL, Farcaster automatically 
              displays the OG image as a rich embed.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Benefits */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Benefits
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Artists
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Promote your new listings
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Beautiful visual previews
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Easy sharing on social media
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Drive traffic to your auctions
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Collectors
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Share your bidding activity
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Celebrate auction wins
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Showcase your collection
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Engage with the community
              </li>
            </ul>
          </div>
        </div>
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

