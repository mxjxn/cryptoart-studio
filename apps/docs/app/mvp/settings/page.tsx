'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Settings
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Customize your notification preferences and manage your account settings.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The settings page allows you to customize your marketplace experience. Currently, the main focus is on 
          notification preferences, giving you control over which notifications you receive and how they're delivered.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Access settings from your profile dropdown menu. All preferences are saved automatically and apply immediately.
        </p>
      </TerminalCard>

      {/* Notification Preferences */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Notification Preferences
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Control which notifications you receive and how they're delivered:
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Notification Types
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Enable or disable specific types of notifications:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • New bids on your auctions
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Outbid alerts
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Auction ending reminders
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Purchase confirmations
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Offer updates
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Auction finalization
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Delivery Methods
            </h3>
            <p className="font-mono text-sm mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Choose how you receive notifications:
            </p>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • <strong>In-App</strong> - Notifications appear in the app's notification center
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • <strong>Push Notifications</strong> - Receive push notifications on your device (requires token setup)
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Frequency
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Control notification frequency to avoid being overwhelmed. You can choose to receive all notifications, 
              only important ones, or customize per notification type.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Push Notifications */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Push Notifications
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          To receive push notifications on your device, you need to register a notification token:
        </p>
        <ol className="space-y-3 list-decimal list-inside mb-4">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Enable push notifications in your device/browser settings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Grant permission when prompted by the app
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Your notification token is automatically registered
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            You'll receive push notifications based on your preferences
          </li>
        </ol>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Notification tokens are linked to your Farcaster account and stored securely. You can manage your tokens 
          in the settings page.
        </p>
      </TerminalCard>

      {/* Account Settings */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Account Settings
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Additional account settings may include:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Profile Information</strong> - Manage your public profile (linked to Farcaster)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Wallet Connections</strong> - Manage connected wallets
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Privacy Settings</strong> - Control what information is visible
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Data Management</strong> - Export or manage your data
          </li>
        </ul>
        <p className="font-mono mt-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Note: Many account settings are managed through your Farcaster account, as the marketplace integrates 
          with Farcaster for authentication and profile information.
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

