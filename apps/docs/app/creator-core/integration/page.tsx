import { getCreatorCoreDocContent } from '@/lib/markdown';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Link from 'next/link';

export default function Integration() {
  const doc = getCreatorCoreDocContent('INTEGRATION_GUIDE.md');

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
        <h1 className="text-4xl font-bold mb-8">Integration Guide</h1>
        <p style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Documentation not available.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="mb-8">
        <Link href="/creator-core" className="font-mono" style={{ color: 'var(--color-primary)' }}>
          ← Back to Creator Core
        </Link>
      </div>
      
      <MarkdownRenderer content={doc.content} />
    </div>
  );
}

