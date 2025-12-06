'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

const notificationTypes = [
  {
    title: 'New Bids',
    description: 'Get notified when someone places a bid on your auction. See the bid amount and bidder information instantly.',
  },
  {
    title: 'Outbid Alerts',
    description: 'Receive an alert immediately when you get outbid on an auction you were winning. Place a new bid to stay competitive.',
  },
  {
    title: 'Auction Ending',
    description: 'Get reminders when your auction is about to end or when an auction you\'re bidding on is closing soon.',
  },
  {
    title: 'Purchase Confirmations',
    description: 'Confirm when you successfully purchase an NFT or when someone purchases from your fixed-price listing.',
  },
  {
    title: 'Offer Updates',
    description: 'Get notified when sellers respond to your offers—whether accepted, rejected, or countered.',
  },
  {
    title: 'Auction Finalized',
    description: 'Know when your auction completes and the NFT is transferred, or when you win an auction.',
  },
]

export default function NotificationsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Notifications
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Stay informed with real-time notifications for bids, outbids, auction endings, and more.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The notification system keeps you updated on all important marketplace activities. Whether you're an artist 
          tracking bids on your auctions or a collector monitoring auctions you're bidding on, notifications ensure 
          you never miss important updates.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Notifications are delivered in real-time and integrated with Farcaster, so you can see updates directly in 
          your Farcaster feed.
        </p>
      </TerminalCard>

      {/* Notification Types */}
      <div className="space-y-8 mb-12">
        <h2 className="text-3xl font-bold uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Notification Types
        </h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          {notificationTypes.map((notification) => (
            <TerminalCard key={notification.title}>
              <h3 className="text-xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
                {notification.title}
              </h3>
              <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                {notification.description}
              </p>
            </TerminalCard>
          ))}
        </div>
      </div>

      {/* For Artists */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          For Artists
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          As an artist, you'll receive notifications for:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>New bids</strong> on your auctions
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Auction ending</strong> reminders
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Purchases</strong> from your fixed-price listings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Offers</strong> on your offers-only listings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Auction finalization</strong> when your auction completes
          </li>
        </ul>
      </TerminalCard>

      {/* For Collectors */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          For Collectors
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          As a collector, you'll receive notifications for:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Outbid alerts</strong> when someone outbids you
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Auction ending</strong> reminders for auctions you're bidding on
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Purchase confirmations</strong> when you successfully buy an NFT
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Offer responses</strong> when sellers respond to your offers
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Auction wins</strong> when you win an auction
          </li>
        </ul>
      </TerminalCard>

      {/* Real-Time Updates */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Real-Time Updates
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Notifications are delivered in real-time as events happen on-chain:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Instant delivery when transactions are confirmed
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • No need to refresh the page
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Based on blockchain events from the subgraph
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Integrated with Farcaster notifications
          </li>
        </ul>
      </TerminalCard>

      {/* Notification Preferences */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Notification Preferences
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          You can customize which notifications you receive:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Enable or disable specific notification types
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Choose delivery methods (in-app, Farcaster)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Set notification frequency preferences
          </li>
        </ul>
        <p className="font-mono mt-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Access your notification preferences from your profile settings.
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

