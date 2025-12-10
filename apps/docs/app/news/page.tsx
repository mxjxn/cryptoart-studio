import { getAllNewsPosts } from '../../lib/news';
import { TerminalCard } from '../../components/TerminalCard';
import { TerminalLink } from '../../components/TerminalLink';
import { GradientHeader } from '../../components/GradientHeader';

export default async function NewsPage() {
  const posts = getAllNewsPosts();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono">
      <div className="mb-12">
        <GradientHeader className="text-4xl md:text-5xl mb-4">
          News & Updates
        </GradientHeader>
        <p className="text-lg" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Stay up to date with the latest development progress, features, and announcements.
        </p>
      </div>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <TerminalCard>
            <p style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              No news posts yet. Check back soon!
            </p>
          </TerminalCard>
        ) : (
          posts.map((post) => (
            <TerminalCard key={post.slug} className="hover:opacity-90 transition-opacity">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2 uppercase" style={{ color: 'var(--color-primary)' }}>
                    {post.title}
                  </h2>
                  {post.version && (
                    <div className="text-sm mb-2" style={{ color: 'var(--color-secondary)' }}>
                      Version: {post.version}
                    </div>
                  )}
                  {post.excerpt && (
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text)', opacity: 0.9 }}>
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {post.author && ` • ${post.author}`}
                </div>
                <TerminalLink href={`/news/${post.slug}`} className="text-sm uppercase">
                  Read more →
                </TerminalLink>
              </div>
            </TerminalCard>
          ))
        )}
      </div>
    </div>
  );
}

