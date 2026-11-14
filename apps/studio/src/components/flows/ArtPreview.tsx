'use client';

import { cn } from '~/lib/utils';

type ArtPreviewProps = {
  src?: string | null;
  alt?: string;
  aspectRatio?: string;
  caption?: string;
  subtitle?: string;
  className?: string;
  /** Prefer object-contain so native aspect is preserved — never crop to squares. */
  contain?: boolean;
};

export function ArtPreview({
  src,
  alt = '',
  aspectRatio = '4 / 5',
  caption,
  subtitle,
  className,
  contain = true,
}: ArtPreviewProps) {
  return (
    <figure className={cn('gallery-fade-in flex flex-col gap-3', className)}>
      <div
        className="relative w-full overflow-hidden rounded-md bg-background-sunken"
        style={{ aspectRatio }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className={cn(
              'absolute inset-0 size-full',
              contain ? 'object-contain' : 'object-cover',
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-lg text-muted-foreground">No preview</span>
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
