import Link from 'next/link';
import { cn } from '~/lib/utils';

interface ArtCardProps {
  href: string;
  imageUrl?: string | null;
  name: string;
  tokenId: number | string;
  className?: string;
}

export function ArtCard({ href, imageUrl, name, tokenId, className }: ArtCardProps) {
  return (
    <Link href={href} className={cn('group block', className)}>
      <div className="overflow-hidden rounded-md bg-background-sunken">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-auto w-full object-contain transition-opacity duration-base group-hover:opacity-90"
          />
        ) : (
          <div className="flex aspect-[4/5] size-full items-center justify-center text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="font-display text-base text-foreground">{name}</p>
        <p className="text-sm text-muted">#{tokenId}</p>
      </div>
    </Link>
  );
}
