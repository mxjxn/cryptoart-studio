import Link from 'next/link';

const TOOLS = [
  {
    title: 'Deploy collections',
    description: 'Launch ERC-721 contracts on Base or Ethereum with guided setup and saved drafts.',
  },
  {
    title: 'Mint your work',
    description: 'Upload to Arweave, mint single pieces or full series, and manage metadata on-chain.',
  },
  {
    title: 'Manage contracts',
    description: 'Track collections, edit tokens, and share public preview pages from one dashboard.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="py-20 md:py-28">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Artist dashboard
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Create, mint, and manage your on-chain collections.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          cryptoart.studio is your control plane for contract deployment and NFT management —
          built for artists who want clarity over complexity.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/dashboard" className="studio-btn">
            Enter studio
          </Link>
          <Link href="/dashboard" className="studio-btn-outline">
            Connect wallet
          </Link>
        </div>
      </section>

      <section className="grid gap-6 pb-24 md:grid-cols-3">
        {TOOLS.map((tool) => (
          <article key={tool.title} className="studio-card">
            <h2 className="text-lg font-bold">{tool.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{tool.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
