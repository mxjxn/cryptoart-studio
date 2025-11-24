import { getDocContent } from '@/lib/markdown';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Link from 'next/link';
import { TerminalLink } from '@/components/TerminalLink';

export default function GettingStarted() {
  const doc = getDocContent('README.md');

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
        <h1 className="text-4xl font-bold mb-8">Getting Started</h1>
        <p style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Documentation not available.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="mb-8">
        <Link href="/" className="font-mono" style={{ color: 'var(--color-primary)' }}>
          ← Back to Home
        </Link>
      </div>
      
      <MarkdownRenderer content={doc.content} />
      
      <div className="mt-12 pt-8 border-t-2" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-2xl font-bold mb-4 uppercase" style={{ color: 'var(--color-primary)' }}>
          Next Steps
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/capabilities" className="p-4 border-2 font-mono hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="font-semibold mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
              Capabilities →
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Learn about all marketplace features
            </div>
          </Link>
          
          <Link href="/integration" className="p-4 border-2 font-mono hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="font-semibold mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
              Integration Guide →
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Integrate with Creator Core contracts
            </div>
          </Link>
          
          <Link href="/deployment" className="p-4 border-2 font-mono hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="font-semibold mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
              Deployment →
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              Deploy contracts to testnet or mainnet
            </div>
          </Link>
          
          <Link href="/examples" className="p-4 border-2 font-mono hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="font-semibold mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
              Examples →
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              View example contracts and use cases
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

