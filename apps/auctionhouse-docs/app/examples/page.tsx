import { getDocContent } from '@/lib/markdown';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Link from 'next/link';

export default function Examples() {
  const examplesDoc = getDocContent('src/examples/README.md');
  const artExamplesDoc = getDocContent('src/examples/ART_EXAMPLES.md');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="mb-8">
        <Link href="/" className="font-mono" style={{ color: 'var(--color-primary)' }}>
          ← Back to Home
        </Link>
      </div>
      
      {examplesDoc && (
        <div className="mb-12">
          <MarkdownRenderer content={examplesDoc.content} />
        </div>
      )}

      {artExamplesDoc && (
        <div className="mt-12 pt-8 border-t-2" style={{ borderColor: 'var(--color-border)' }}>
          <MarkdownRenderer content={artExamplesDoc.content} />
        </div>
      )}

      {!examplesDoc && !artExamplesDoc && (
        <div>
          <h1 className="text-4xl font-bold mb-8">Examples</h1>
          <p style={{ color: 'var(--color-text)', opacity: 0.8 }}>
            Documentation not available.
          </p>
        </div>
      )}
    </div>
  );
}

