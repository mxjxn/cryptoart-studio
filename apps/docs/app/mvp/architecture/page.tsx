'use client'

import { GradientHeader } from '../../../components/GradientHeader'
import { TerminalCard } from '../../../components/TerminalCard'
import { TerminalLink } from '../../../components/TerminalLink'

export default function ArchitecturePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <GradientHeader className="text-5xl mb-4">
          Architecture
        </GradientHeader>
        <p className="text-xl max-w-3xl mx-auto" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          High-level overview of the cryptoart.social MVP architecture and components.
        </p>
      </div>

      {/* Overview */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          The cryptoart.social MVP is built as a Farcaster mini-app using Next.js, with data sourced from 
          blockchain subgraphs and smart contracts deployed on Base Mainnet. The architecture is designed 
          to be transparent, decentralized, and social-first.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
          All marketplace data comes directly from on-chain events indexed by The Graph Protocol, ensuring 
          transparency and verifiability. User authentication and social features are integrated with Farcaster.
        </p>
      </TerminalCard>

      {/* Main Components */}
      <div className="space-y-8 mb-12">
        <h2 className="text-3xl font-bold uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Main Components
        </h2>
        
        <TerminalCard>
          <h3 className="text-2xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
            Frontend Application
          </h3>
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            Built with Next.js 15 using the App Router, the frontend provides the user interface for the marketplace. 
            It's a Farcaster mini-app that runs directly within Warpcast and other Farcaster clients.
          </p>
          <ul className="space-y-2">
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Next.js 15</strong> - React framework with App Router
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>TypeScript</strong> - Type-safe development
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Tailwind CSS</strong> - Styling
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Farcaster Mini App SDK</strong> - Integration with Farcaster
            </li>
          </ul>
        </TerminalCard>

        <TerminalCard>
          <h3 className="text-2xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
            Data Layer (Subgraph)
          </h3>
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            The Graph Protocol subgraph indexes all on-chain events from the marketplace contracts, providing 
            a queryable API for listings, bids, purchases, and other marketplace activity.
          </p>
          <ul className="space-y-2">
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>The Graph Protocol</strong> - Decentralized indexing
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>GraphQL API</strong> - Query marketplace data
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Real-time updates</strong> - Events indexed as they occur
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>All data from blockchain</strong> - Transparent and verifiable
            </li>
          </ul>
        </TerminalCard>

        <TerminalCard>
          <h3 className="text-2xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
            Smart Contracts
          </h3>
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            The marketplace runs on smart contracts deployed on Base Mainnet. These contracts handle listing 
            creation, bidding, purchasing, and all marketplace logic.
          </p>
          <ul className="space-y-2">
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Auctionhouse Contracts</strong> - Marketplace logic and listing management
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Membership Registry</strong> - STP v2 NFT verification for sellers
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Base Mainnet</strong> - Deployed and verified on-chain
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>ERC721 & ERC1155</strong> - Support for all NFT standards
            </li>
          </ul>
        </TerminalCard>

        <TerminalCard>
          <h3 className="text-2xl font-bold mb-3 uppercase" style={{ color: 'var(--color-primary)' }}>
            User Authentication
          </h3>
          <p className="font-mono mb-4" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
            User authentication and social features are integrated with Farcaster, leveraging the Farcaster 
            social graph and identity system.
          </p>
          <ul className="space-y-2">
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Farcaster Sign-In</strong> - Authenticate with your Farcaster account
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Wallet Integration</strong> - Connect Ethereum wallets for transactions
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Social Graph</strong> - Leverage Farcaster following relationships
            </li>
            <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              • <strong>Profile Data</strong> - Farcaster usernames, avatars, and metadata
            </li>
          </ul>
        </TerminalCard>
      </div>

      {/* Data Flow */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Data Flow
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              1. Listing Creation
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              User creates listing → Transaction sent to smart contract → NFT transferred to marketplace → 
              Event emitted → Subgraph indexes event → Frontend displays new listing
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              2. Bidding & Purchasing
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              User places bid/purchase → Transaction sent to smart contract → Payment processed → 
              Event emitted → Subgraph indexes event → Frontend updates listing status
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              3. Data Querying
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Frontend queries subgraph → Subgraph returns indexed data → Frontend renders UI → 
              User sees marketplace data in real-time
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Key Principles */}
      <TerminalCard className="mb-12">
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Key Principles
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Decentralized
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All marketplace logic runs on smart contracts. No centralized servers control listings or transactions.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Transparent
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All data comes from on-chain events. Every listing, bid, and purchase is verifiable on the blockchain.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Social-First
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              Built natively for Farcaster with integrated social features and profile information.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Open Source
            </h3>
            <p className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
              All code is open source and available for inspection, auditing, and contribution.
            </p>
          </div>
        </div>
      </TerminalCard>

      {/* Technology Stack */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Technology Stack
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Frontend
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Next.js 15
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • React 19
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • TypeScript
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Tailwind CSS
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 uppercase" style={{ color: 'var(--color-secondary)' }}>
              Blockchain
            </h3>
            <ul className="space-y-1">
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Base Mainnet
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Wagmi + Viem
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • The Graph Protocol
              </li>
              <li className="font-mono text-sm" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                • Farcaster Auth Kit
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

