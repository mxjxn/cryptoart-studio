'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function FeaturedSectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Featured Sections
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Curated sections on the homepage showcasing selected artworks and collections. Admins can create and manage featured content.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Featured sections are curated collections of listings that appear prominently on the homepage. They help showcase 
          the best artworks, highlight trending collections, and guide users to discover new art.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          The homepage features two types of featured content: a manual featured carousel at the top, and dynamic 
          featured sections below that can be customized by admins.
        </p>
      </TerminalCard>

      {/* Featured Carousel */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Featured Carousel
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The featured carousel appears at the very top of the homepage, before all other content. It displays manually 
          curated listings in a horizontal scrolling carousel format.
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Manual Curation
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Admins can manually add or remove listings from the featured carousel. This gives complete control over 
              which artworks appear at the top of the homepage.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Auto-Refresh Option
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Admins can enable auto-refresh mode, which automatically updates the carousel with new listings based on 
              configurable criteria (e.g., recently created, highest bids, etc.).
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Priority Display
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              The carousel always appears first on the homepage, ensuring maximum visibility for featured listings.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Featured Sections */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Dynamic Featured Sections
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Below the featured carousel, the homepage displays dynamic featured sections. These are curated collections 
          that can be organized by theme, artist, collection, or any other criteria.
        </p>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Custom Sections
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Admins can create custom sections with titles, descriptions, and curated listings. Each section can 
              have its own display format (carousel or grid).
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Display Formats
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • <strong>Carousel</strong> - Horizontal scrolling display
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • <strong>Grid</strong> - Grid layout for multiple items
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Section Management
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Admins can create, edit, reorder, activate, and deactivate sections. Sections can be reordered to 
              control their display order on the homepage.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Gallery Integration
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Admins can convert curated galleries into featured sections with one click, making it easy to feature 
              gallery collections on the homepage.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Admin Management */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Admin Management
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Featured content is managed through the admin panel. Only admins can:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Add or remove listings from the featured carousel
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Enable or disable auto-refresh for the carousel
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Create, edit, and delete featured sections
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Add listings to featured sections
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Reorder sections to control display order
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • Convert galleries into featured sections
          </li>
        </ul>
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
                • Increased visibility for featured listings
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Showcase in curated collections
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Homepage placement drives traffic
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              For Collectors
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Discover curated, high-quality art
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • See trending and featured collections
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Guided discovery experience
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

