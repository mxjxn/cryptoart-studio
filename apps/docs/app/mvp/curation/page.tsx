'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function CurationPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Curation & Galleries
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Create and publish curated galleries of listings. Organize collections and feature them on the homepage.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The curation system allows admins to create galleries—curated collections of listings organized around a theme, 
          artist, collection, or any other criteria. Galleries can be published for public viewing or kept private.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Published galleries can be viewed by anyone, and admins can convert galleries into featured sections to 
          showcase them on the homepage.
        </p>
      </TerminalCard>

      {/* Creating Galleries */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Creating Galleries
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Only admins can create galleries. To create a gallery:
        </p>
        <ol className="space-y-3 list-decimal list-inside mb-4">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Navigate to the curation page (admin-only)
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Click "Create Gallery" and provide a title and optional description
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Add listings to your gallery by searching and selecting them
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Reorder listings to control their display order
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Publish the gallery to make it publicly visible
          </li>
        </ol>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Galleries can be edited, reordered, and republished at any time. Unpublished galleries are only visible to admins.
        </p>
      </TerminalCard>

      {/* Gallery Features */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Gallery Features
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Title & Description
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Each gallery has a title and optional description. Use these to explain the theme or purpose of your gallery.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Listing Management
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Add any number of listings to a gallery. You can search for listings by ID, contract address, or token ID. 
              Remove listings at any time.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Display Order
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Reorder listings within a gallery to control how they appear. The first listing in the order appears first 
              in the gallery view.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Publishing
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Publish galleries to make them publicly visible. Published galleries can be viewed by anyone and appear 
              in public gallery listings. Unpublish to hide them from public view.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Public Galleries */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Public Gallery Viewing
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Published galleries are publicly accessible and can be viewed by anyone:
        </p>
        <ul className="space-y-2">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Gallery URLs</strong> - Each published gallery has a unique URL with a slug
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Profile Integration</strong> - Published galleries appear on admin profiles
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Gallery Browsing</strong> - View all listings in a gallery with artwork previews
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            • <strong>Direct Links</strong> - Share gallery URLs to showcase curated collections
          </li>
        </ul>
      </TerminalCard>

      {/* Featured Section Integration */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Featured Section Integration
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          Admins can convert galleries into featured sections to showcase them on the homepage:
        </p>
        <ol className="space-y-3 list-decimal list-inside mb-4">
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Create and publish a gallery with your curated listings
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            In the admin featured sections page, select "Create from Gallery"
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Choose your gallery and provide a title/description for the section
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            The gallery's listings are automatically added to the featured section
          </li>
          <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            The section appears on the homepage in the featured sections area
          </li>
        </ol>
        <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          This makes it easy to curate collections in galleries and then feature them prominently on the homepage.
        </p>
      </TerminalCard>

      {/* Use Cases */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Use Cases
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Themed Collections
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Create galleries around themes like "Abstract Art", "Digital Landscapes", or "Generative Art" to 
              help collectors discover related works.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Artist Spotlights
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Curate galleries featuring a specific artist's work to showcase their portfolio and help collectors 
              discover their art.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Trending Collections
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Create galleries of trending or popular listings to highlight what's hot in the marketplace.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Homepage Features
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Convert galleries into featured sections to showcase curated collections prominently on the homepage.
            </p>
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

