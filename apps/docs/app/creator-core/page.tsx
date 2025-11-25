'use client'

import { GradientHeader } from '../../components/GradientHeader'
import { TerminalCard } from '../../components/TerminalCard'
import { TerminalLink } from '../../components/TerminalLink'

export default function CreatorCoreHome() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Creator Core Contracts
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto mb-6" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          Extendible ERC721/ERC1155 creator contracts with extension system, upgradeable proxy support, 
          and comprehensive royalty management. A library for building flexible NFT collections.
        </p>
        <div className="max-w-2xl mx-auto">
          <TerminalCard className="text-center">
            <p className="text-sm font-mono mb-2" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              <strong style={{ color: 'var(--color-primary)' }}>Created by Manifold</strong>
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
              All contracts, architecture, and core functionality developed by{' '}
              <TerminalLink href="https://manifold.xyz" external>Manifold</TerminalLink>
              {' • '}
              Documentation and deployment tooling by{' '}
              <TerminalLink href="https://github.com/mxjxn" external>mxjxn</TerminalLink>
            </p>
          </TerminalCard>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        <TerminalCard title="ERC721 & ERC1155">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Full support for both ERC721 (unique NFTs) and ERC1155 (multi-token) standards with 
            upgradeable and non-upgradeable variants.
          </p>
          <TerminalLink href="/creator-core/architecture" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="EXTENSION SYSTEM">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Powerful extension framework allowing you to add custom functionality like dynamic pricing, 
            lazy minting, and custom transfer logic.
          </p>
          <TerminalLink href="/creator-core/architecture" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="UPGRADEABLE PROXIES">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Support for upgradeable proxy pattern using ERC1967, allowing bug fixes and feature 
            additions post-deployment.
          </p>
          <TerminalLink href="/creator-core/deployment" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="ROYALTY MANAGEMENT">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Comprehensive royalty system supporting EIP-2981, Manifold Registry, and Rarible V2 
            with per-token and per-extension configuration.
          </p>
          <TerminalLink href="/creator-core/architecture" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="INTEGRATION GUIDE">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Step-by-step guide for integrating with marketplaces, building extensions, and 
            setting up royalty systems.
          </p>
          <TerminalLink href="/creator-core/integration" className="text-sm uppercase">
            Learn more →
          </TerminalLink>
        </TerminalCard>

        <TerminalCard title="DEPLOYMENT">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Complete deployment guide covering direct deployment, proxy patterns, and 
            network-specific considerations.
          </p>
          <TerminalLink href="/creator-core/deployment" className="text-sm uppercase">
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
            <TerminalLink href="https://github.com/mxjxn/cryptoart-monorepo/tree/main/packages/creator-core-contracts" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
          
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              Manifold Studio
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Original implementation
            </div>
            <TerminalLink href="https://studio.manifoldxyz.dev/" external className="text-xs mt-2 block">
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
            <TerminalLink href="/creator-core/getting-started" className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
          
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              Architecture
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Deep dive into contracts
            </div>
            <TerminalLink href="/creator-core/architecture" className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
        </div>
      </TerminalCard>

      {/* Attribution */}
      <div className="mt-16 text-center">
        <TerminalCard className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 uppercase" style={{ color: 'var(--color-primary)' }}>
            Attribution
          </h2>
          <div className="grid md:grid-cols-2 gap-8 text-left">
            <div>
              <h3 className="font-bold text-lg mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
                From Manifold
              </h3>
              <p className="text-xs mb-3 font-mono" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                All contract development, architecture, and core functionality
              </p>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                <li>• Creator Core contracts (ERC721/ERC1155)</li>
                <li>• Extension system architecture</li>
                <li>• Royalty management system</li>
                <li>• Proxy pattern implementation</li>
                <li>• Security patterns & testing</li>
                <li>• Core marketplace functionality</li>
              </ul>
              <div className="mt-4">
                <TerminalLink href="https://manifold.xyz" external className="text-sm">
                  Learn more about Manifold →
                </TerminalLink>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3 uppercase" style={{ color: 'var(--color-secondary)' }}>
                From mxjxn
              </h3>
              <p className="text-xs mb-3 font-mono" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                Documentation and tooling (future enhancements planned)
              </p>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
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

