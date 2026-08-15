import Link from 'next/link';

const FEATURES = [
  {
    title: 'Deploy Collections',
    description: 'ERC-721 contracts on Base and Ethereum. Your art, your rules.',
    icon: 'file-text',
  },
  {
    title: 'Mint Work',
    description: 'Single pieces or batch series. Pin to Arweave, metadata first.',
    icon: 'paintbrush',
  },
  {
    title: 'Public Pages',
    description: 'Every collection and token gets a shareable public view.',
    icon: 'gallery',
  },
] as const;

function FeatureIcon({ icon }: { icon: string }) {
  if (icon === 'file-text') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }
  if (icon === 'paintbrush') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 00-2.82 0L8 7l9 9 1.59-1.59a2 2 0 000-2.82L17 10l4.37-4.37a2.12 2.12 0 10-3-3z" />
        <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
        <path d="M14.5 17.5L4.5 15" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="14" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="14" width="8" height="8" rx="1" />
      <rect x="14" y="14" width="8" height="8" rx="1" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="flex h-[640px] flex-col items-center justify-center gap-12 bg-white px-16">
        <div className="flex max-w-[800px] flex-col items-center gap-5 text-center">
          <h1 className="text-[72px] font-extrabold leading-[1.1] tracking-tight text-foreground">
            The on-chain artist studio
          </h1>
          <p className="text-xl leading-relaxed text-muted">
            Deploy collections. Mint your work. Own every layer.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard" className="studio-btn">
            Start Creating
          </Link>
          <Link href="/c" className="studio-btn-outline">
            View Public Galleries
          </Link>
        </div>
      </section>

      <section className="bg-white px-16 py-[120px]">
        <div className="mx-auto grid max-w-[1120px] gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-6 rounded-lg border border-border p-10"
            >
              <div className="text-foreground">
                <FeatureIcon icon={feature.icon} />
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold">{feature.title}</h2>
                <p className="text-[15px] leading-relaxed text-muted">{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-8 px-16 pb-12 pt-20">
        <div className="mx-auto h-px w-full max-w-[1120px] bg-border" />
        <p className="text-sm font-medium text-muted">Built for artists. Not speculators.</p>
      </footer>
    </>
  );
}
