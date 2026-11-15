'use client';

import { useEffect, useState } from 'react';
import { pinnedMediaForMint, type PinnedMedia, type UploadJob } from '@cryptoart/media/client';

/**
 * Track A (mint) can call this with the upload job id.
 * Mint the token with `pin.metadataUri` only when `pin.mintEnabled` is true.
 * `pin.mediaUri` is the artwork inside that metadata, and `pin.gatewayUrl`
 * is a gateway link for the same object.
 */
export function usePinnedMedia(jobId: string | null, refreshKey = 0) {
  const [pin, setPin] = useState<PinnedMedia | null>(null);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setPin(null);
      setJob(null);
      setError(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    fetch(`/api/media/jobs/${jobId}`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json() as { job?: UploadJob; pin?: PinnedMedia | null; error?: string };
        if (!response.ok || !body.job) throw new Error(body.error || 'Upload job not found');
        if (cancel) return;
        setJob(body.job);
        setPin(body.pin ?? pinnedMediaForMint(body.job));
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Upload job not found');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [jobId, refreshKey]);

  return { pin, job, error, loading };
}
