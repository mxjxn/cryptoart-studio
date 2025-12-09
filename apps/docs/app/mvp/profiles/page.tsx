'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function ProfilesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Profiles
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          View your created auctions, collected NFTs, and active bids. Discover artists and collectors through public profiles.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Profiles are your personal portfolio on cryptoart.social. They showcase your activity as both a creator 
          and collector, giving you a comprehensive view of your marketplace engagement.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Profiles are integrated with your Farcaster account, so your Farcaster username and profile information 
          appear automatically. You can also view public profiles of other users to discover artists and collectors.
        </p>
      </TerminalCard>

      {/* Your Profile */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Your Profile
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Your personal profile shows everything you've done on the marketplace:
        </p>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Created Auctions
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All auctions you've created, organized by status (active, concluded, cancelled). See your sales history 
              and track which auctions have bids or offers.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Collected NFTs
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All NFTs you've purchased through the marketplace. Build your collection and showcase your art purchases 
              in one place.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Active Bids
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Track all auctions where you currently have the highest bid. Monitor your bids and see if you get outbid.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Active Offers
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              View all offers you've submitted on offers-only listings. See which offers have been accepted, rejected, 
              or are still pending.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Favorites
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Listings you've favorited for easy access later. Keep track of auctions you're interested in but not 
              ready to bid on yet. Favorite any listing with one click.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Following & Followers
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Follow artists and collectors to stay updated on their new listings and activity. See who follows you 
              and build your community.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Galleries (Admins)
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              If you're an admin, view your curated galleries. Create collections of listings and publish them 
              for public viewing or feature them on the homepage.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Public Profiles */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Public Profiles
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Explore public profiles to discover artists and collectors in the community:
        </p>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Artist Discovery
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              View an artist's profile to see all their created auctions, recent sales, and available listings. 
              Follow artists you like to stay updated on their new work.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Collector Profiles
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              See what other collectors are buying. Discover new artists through their collections and see trending 
              artworks in the community.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Social Integration
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Profiles are linked to Farcaster, so you can see Farcaster usernames, avatars, and follow relationships. 
              The marketplace seamlessly integrates with your Farcaster social graph. Follow and favorite features 
              work across the platform.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Social Features */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Social Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Favorites
            </h3>
            <p className="font-mono text-sm mb-3" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Save listings you're interested in for later. Your favorites are private and help you track auctions 
              you want to watch or bid on.
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • One-click favorite/unfavorite
              </li>
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • View all favorites in your profile
              </li>
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • Quick access to saved listings
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Follows
            </h3>
            <p className="font-mono text-sm mb-3" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Follow artists and collectors to discover their new listings and activity. Build your network and 
              stay updated on creators you love.
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • Follow/unfollow from any profile
              </li>
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • See who you follow and who follows you
              </li>
              <li className="font-mono text-xs" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                • Discover new artists through your network
              </li>
            </ul>
          </div>
        </div>
      </TerminalCard>

      {/* Profile Features */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Profile Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Farcaster Integration
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Farcaster username display
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Profile avatar from Farcaster
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Follow/unfollow functionality
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • ENS name support
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Portfolio View
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Complete auction history
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Collection showcase
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Activity timeline
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Statistics and metrics
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



