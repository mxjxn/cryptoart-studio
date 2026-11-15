'use client';

import { useEffect, useState } from 'react';
import { pinnedMediaForMint, type PinnedMedia, type UploadJob } from '@cryptoart/media/client';

/**
 * Track A (mint) can call this with the upload job id.
 * Mint the token with `pin.metadataUri` only when `pin.mintEnabled` is true.
 * `pin.mediaUri` is the artwork inside that metadata, and `pin.gatewayUrl`
 * is a gateway link for the same object.
 */
type LoadedPin = {
  jobId: string;
  refreshKey: number;
  pin: PinnedMedia | null;
  job: UploadJob | null;
  error: string | null;
};

export function usePinnedMedia(jobId: string | null, refreshKey = 0) {
  const [loaded, setLoaded] = useState<LoadedPin | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancel = false;
    fetch(`/api/media/jobs/${jobId}`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json() as { job?: UploadJob; pin?: PinnedMedia | null; error?: string };
        if (!response.ok || !body.job) throw new Error(body.error || 'Upload job not found');
        if (cancel) return;
        setLoaded({
          jobId,
          refreshKey,
          job: body.job,
          pin: body.pin ?? pinnedMediaForMint(body.job),
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const message = err instanceof Error ? err.message : 'Upload job not found';
        setLoaded((previous) => ({
          jobId,
          refreshKey,
          pin: previous?.jobId === jobId ? previous.pin : null,
          job: previous?.jobId === jobId ? previous.job : null,
          error: message,
        }));
      });
    return () => {
      cancel = true;
    };
  }, [jobId, refreshKey]);

  if (!jobId) return { pin: null, job: null, error: null, loading: false };
  const forJob = loaded?.jobId === jobId ? loaded : null;
  const fresh = forJob?.refreshKey === refreshKey ? forJob : null;
  return {
    pin: forJob?.pin ?? null,
    job: forJob?.job ?? null,
    error: fresh?.error ?? null,
    loading: fresh == null,
  };
}
