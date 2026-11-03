'use client';

import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '~/lib/utils';

interface DropZoneProps {
  accept?: string;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
  className?: string;
}

export function DropZone({
  accept,
  onFiles,
  label = 'Drag and drop your file here',
  hint,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
        isDragging ? 'border-foreground bg-neutral-50' : 'border-border',
        className,
      )}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-muted">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[13px] text-muted">or</p>
      <label className="mt-2 cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground">
        Browse Files
        <input type="file" accept={accept} onChange={handleChange} className="hidden" />
      </label>
      {hint && <p className="mt-4 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
