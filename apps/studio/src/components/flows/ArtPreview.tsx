'use client';

import { cn } from '~/lib/utils';

type ArtPreviewProps = {
  src?: string | null;
  alt?: string;
  /** CSS aspect-ratio for the frame when media is loading or empty. */
  aspectRatio?: string;
  caption?: string;
  subtitle?: string;
  className?: string;
  /** Prefer object-contain so native aspect is preserved — never crop to squares. */
  contain?: boolean;
  /** Treat as animated/video media (uses <video> for common video types, otherwise img). */
  animated?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
};

function isVideoSrc(src: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(src);
}

export function ArtPreview({
  src,
  alt = '',
  aspectRatio = '4 / 5',
  caption,
  subtitle,
  className,
  contain = true,
  animated = false,
  emptyTitle = 'No artwork yet',
  emptyHint = 'Upload or attach a piece and it will appear here at its natural shape.',
}: ArtPreviewProps) {
  const hasArt = Boolean(src);

  return (
    <figure className={cn('gallery-fade-in flex flex-col gap-3', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md',
          hasArt ? 'bg-background-sunken' : 'border border-dashed border-border bg-background-sunken',
        )}
        style={hasArt ? undefined : { aspectRatio }}
      >
        {hasArt && src ? (
          isVideoSrc(src) ? (
            <video
              src={src}
              className={cn('h-auto w-full', contain ? 'object-contain' : 'object-cover')}
              autoPlay
              muted
              loop
              playsInline
              aria-label={alt || caption || 'Artwork preview'}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || caption || ''}
              className={cn(
                'h-auto w-full',
                contain ? 'object-contain' : 'object-cover',
                animated && 'block',
              )}
            />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-display text-xl text-foreground">{emptyTitle}</p>
            <p className="max-w-[16rem] text-sm text-muted">{emptyHint}</p>
          </div>
        )}
      </div>
      {(caption || subtitle) && (
        <figcaption>
          {caption && (
            <p className="font-display text-xl leading-snug text-foreground">{caption}</p>
          )}
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </figcaption>
      )}
    </figure>
  );
}
