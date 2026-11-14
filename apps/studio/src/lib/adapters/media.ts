/**
 * Thin media adapter over studio `/api/media/*` routes (PR 201).
 * Keeps UI independent of whether MediaClient is published in @cryptoart/media yet.
 */

export type MediaConfig = {
  allowMockPayment: boolean;
  hasTurbo?: boolean;
  hasFacilitator?: boolean;
  network: string | null;
  uploaderType?: string;
  maxFileSize: number;
  maxFileSizeMB?: number;
  tempUploadTtlSeconds?: number;
};

export type MediaQuote = {
  idempotencyKey: string;
  usdcAmount: string;
  network: string;
  byteCount: number;
  expiresAt: string;
};

export type MediaJob = {
  id: string;
  status: string;
  media?: { id: string } | null;
  metadata?: { id: string } | null;
  errorMessage?: string | null;
};

const WINSTON_PER_BYTE = 100000n;

/** Approximate USDC cost preview (same heuristic as PR 201 MediaClient.estimateCost). */
export function estimateArweaveCostUsdc(sizeBytes: number): string {
  const safetyMarginBps = 500;
  const winston = BigInt(Math.max(0, sizeBytes)) * WINSTON_PER_BYTE;
  const withMargin = winston + (winston * BigInt(safetyMarginBps)) / 10000n;
  const ar = Number(withMargin) / 1e12;
  const usd = Math.max(ar * 8, 0.01);
  const usdc = BigInt(Math.ceil(usd * 1e6));
  return (Number(usdc) / 1e6).toFixed(2);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchMediaConfig(basePath = '/api/media'): Promise<MediaConfig> {
  const res = await fetch(`${basePath}/config`, { credentials: 'include' });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || 'Failed to load media config');
  return body as MediaConfig;
}

export async function quoteMediaUpload(
  files: { name: string; mimeType: string; size: number; sha256: string }[],
  basePath = '/api/media',
): Promise<{ quote: MediaQuote; status: number }> {
  const res = await fetch(`${basePath}/quote`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const body = await parseJson(res);
  if (!res.ok && res.status !== 402) {
    throw new Error(body.error || 'Quote failed');
  }
  return { quote: body.quote as MediaQuote, status: res.status };
}

export async function createPaidMediaJob(
  idempotencyKey: string,
  paymentHeader: string,
  basePath = '/api/media',
): Promise<MediaJob> {
  const res = await fetch(`${basePath}/jobs`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'X-PAYMENT': paymentHeader,
    },
    body: JSON.stringify({ idempotencyKey, paymentHeader }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || 'Payment failed');
  return body.job as MediaJob;
}

export async function uploadJobMedia(
  jobId: string,
  bytesBase64: string,
  basePath = '/api/media',
): Promise<MediaJob> {
  const res = await fetch(`${basePath}/jobs/${jobId}/media`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bytes: bytesBase64 }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || 'Media upload failed');
  return body.job as MediaJob;
}

export async function uploadJobMetadata(
  jobId: string,
  metadata: { name: string; description?: string; animationUrl?: string; attributes?: unknown[] },
  basePath = '/api/media',
): Promise<MediaJob> {
  const res = await fetch(`${basePath}/jobs/${jobId}/metadata`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || 'Metadata upload failed');
  return body.job as MediaJob;
}

export async function confirmMediaJob(
  jobId: string,
  basePath = '/api/media',
): Promise<{ job: MediaJob; mintEnabled: boolean }> {
  const res = await fetch(`${basePath}/jobs/${jobId}/confirm`, {
    method: 'POST',
    credentials: 'include',
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || body.job?.errorMessage || 'Confirm failed');
  return { job: body.job as MediaJob, mintEnabled: Boolean(body.mintEnabled) };
}

export function metadataUriFromJob(job: MediaJob): string | null {
  return job.metadata?.id ? `ar://${job.metadata.id}` : null;
}
