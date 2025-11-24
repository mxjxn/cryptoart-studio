'use client'

import { GradientHeader } from '../components/GradientHeader'
import { TerminalCard } from '../components/TerminalCard'
import { TerminalLink } from '../components/TerminalLink'

interface Tool {
  name: string
  description: string
  docsUrl: string
  chain: string
  contractAddress?: string
  status: 'deployed' | 'coming-soon'
}

interface DeployedContract {
  name: string
  address: string
  chain: string
}

const tools: Tool[] = [
  {
    name: 'Auctionhouse Contracts',
    description: 'Manifold Gallery auctionhouse contracts with membership-based seller registry',
    docsUrl: '/auctionhouse',
    chain: 'Base',
    contractAddress: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',
    status: 'deployed',
  },
  {
    name: 'NFT Liquidity Pools',
    description: 'Liquidity-Sensitive Single-Variant Market protocol for NFT pools',
    docsUrl: 'https://mxjxn.github.io/such-lssvm/',
    chain: 'Base',
    contractAddress: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e',
    status: 'deployed',
  },
  {
    name: 'Creator Core Contracts',
    description: 'Extendible ERC721/ERC1155 creator contracts with extension system and upgradeable proxy support',
    docsUrl: '/creator-core',
    chain: 'Base',
    status: 'deployed',
  },
]

const deployedContracts: DeployedContract[] = [
  {
    name: 'Auctionhouse Marketplace',
    address: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',
    chain: 'Base',
  },
  {
    name: 'LSSVM Router',
    address: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e',
    chain: 'Base',
  },
]

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <GradientHeader className="text-5xl md:text-6xl">
          CryptoArt Studio
        </GradientHeader>
        <p className="text-lg font-mono" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Developer tools and smart contracts for NFT marketplaces
        </p>
      </div>

      {/* Overview */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Overview
        </h2>
        <p className="font-mono mb-4" style={{ color: 'var(--color-text)' }}>
          CryptoArt Studio provides a comprehensive suite of smart contracts and developer tools for building NFT marketplaces. All contracts are deployed on Base Mainnet and ready for integration.
        </p>
        <p className="font-mono" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Each tool includes detailed documentation, integration guides, and deployment instructions.
        </p>
      </TerminalCard>

      {/* Deployed Tools */}
      <div>
        <h2 className="text-3xl font-bold mb-6 uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Deployed
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {tools
            .filter(tool => tool.status === 'deployed')
            .map((tool) => (
              <TerminalCard key={tool.name} className="flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold uppercase" style={{ color: 'var(--color-primary)' }}>
                    {tool.name}
                  </h3>
                  <span
                    className="text-xs uppercase px-2 py-1 border"
                    style={{
                      borderColor: 'var(--color-success)',
                      color: 'var(--color-success)',
                    }}
                  >
                    Deployed
                  </span>
                </div>
                <p className="font-mono text-sm mb-2 flex-1" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
                  {tool.description}
                </p>
                <p className="font-mono text-xs mb-4" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                  Deployed on {tool.chain}
                </p>
                <div className="flex flex-wrap gap-3">
                  {tool.docsUrl && (
                    <TerminalLink
                      href={tool.docsUrl}
                      external={tool.docsUrl.startsWith('http')}
                      className="text-sm"
                    >
                      Documentation →
                    </TerminalLink>
                  )}
                </div>
              </TerminalCard>
            ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <h2 className="text-3xl font-bold mb-6 uppercase font-mono" style={{ color: 'var(--color-primary)' }}>
          Coming Soon
        </h2>
        <TerminalCard>
          <p className="font-mono text-center" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
            Additional tools and documentation sites will be added here as they are deployed.
          </p>
        </TerminalCard>
      </div>

      {/* Deployed Contracts */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
          Deployed Contracts
        </h2>
        <div className="space-y-3">
          {deployedContracts.map((contract) => (
            <div
              key={contract.address}
              className="flex items-center justify-between p-3 border-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <div className="font-semibold uppercase text-sm" style={{ color: 'var(--color-primary)' }}>
                  {contract.name}
                </div>
                <div className="text-xs font-mono" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                  {contract.chain}
                </div>
              </div>
              <TerminalLink
                href={`https://basescan.org/address/${contract.address}`}
                external
                className="text-xs font-mono"
              >
                {contract.address}
              </TerminalLink>
            </div>
          ))}
        </div>
      </TerminalCard>

      {/* Quick Links */}
      <TerminalCard>
        <h2 className="text-2xl font-bold mb-6 text-center uppercase" style={{ color: 'var(--color-primary)' }}>
          Quick Links
        </h2>
        <div className="grid md:grid-cols-1 gap-4">
          <TerminalCard className="text-center">
            <div className="font-semibold mb-1 uppercase" style={{ color: 'var(--color-primary)' }}>
              GitHub Repository
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              View source code
            </div>
            <TerminalLink href="https://github.com/mxjxn/cryptoart-studio" external className="text-xs mt-2 block">
              Open →
            </TerminalLink>
          </TerminalCard>
        </div>
      </TerminalCard>
      </div>
    </div>
  )
}
