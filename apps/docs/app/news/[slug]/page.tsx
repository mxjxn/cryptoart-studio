import { getNewsPost, getAllNewsPosts } from '../../../lib/news';
import { notFound } from 'next/navigation';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import { TerminalLink } from '../../../components/TerminalLink';
import { GradientHeader } from '../../../components/GradientHeader';

export async function generateStaticParams() {
  const posts = getAllNewsPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default function NewsPostPage({ params }: { params: { slug: string } }) {
  const post = getNewsPost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="mb-8">
        <TerminalLink href="/news" className="text-sm uppercase mb-4 inline-block">
          ← Back to News
        </TerminalLink>
        
        <GradientHeader className="text-4xl md:text-5xl mb-4">
          {post.title}
        </GradientHeader>
        
        <div className="flex flex-wrap items-center gap-4 text-sm mb-6" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
          <span>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          {post.version && (
            <span className="px-2 py-1 border-2" style={{ borderColor: 'var(--color-border)' }}>
              {post.version}
            </span>
          )}
          {post.author && (
            <span>By {post.author}</span>
          )}
        </div>
      </div>

      <div className="markdown">
        <MarkdownRenderer content={post.content} />
      </div>
    </div>
  );
}
