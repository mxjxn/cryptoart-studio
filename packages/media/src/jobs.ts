import { createHash, randomBytes } from 'node:crypto';
import { formatUsdc, METADATA_ALLOWANCE_BYTES, usdcAtomicFromUsd, type UploadCost } from './quote';
import {
  BASE_NETWORK,
  BASE_SEPOLIA_NETWORK,
  BASE_SEPOLIA_USDC,
  BASE_USDC,
} from './networks';
import type { FileQuoteInput, UploadJob, UploadQuote } from './types';

export { BASE_NETWORK, BASE_SEPOLIA_NETWORK, BASE_SEPOLIA_USDC, BASE_USDC } from './networks';

export function quoteUpload(input: {
  files: FileQuoteInput[];
  cost: UploadCost & { usdcAmount?: string; mediaUsdcAmount?: string; metadataUsdcAmount?: string };
  network?: string;
  asset?: string;
  idempotencyKey?: string;
  metadataAllowanceBytes?: number;
  /** @deprecated Treasury pay-to is unused when artists pay Turbo via x402 directly. */
  payTo?: string;
  safetyMarginBps?: number;
}): UploadQuote {
  if (!input.files.length) throw new Error('At least one file is required');
  if (input.files.some((file) => !Number.isInteger(file.size) || file.size <= 0)) {
    throw new Error('Each file needs a positive size');
  }
  const byteCount = input.files.reduce((sum, file) => sum + file.size, 0);
  const metadataAllowanceBytes = input.metadataAllowanceBytes ?? METADATA_ALLOWANCE_BYTES;
  const safetyMarginBps = input.safetyMarginBps ?? 0;
  const usdcAmount = input.cost.usdcAmount
    ?? usdcAtomicFromUsd(input.cost.usd, safetyMarginBps);
  return {
    idempotencyKey: input.idempotencyKey ?? randomBytes(16).toString('hex'),
    files: input.files,
    byteCount,
    arweaveWinston: input.cost.winston,
    usdcAmount,
    usdcDisplay: formatUsdc(usdcAmount),
    usd: input.cost.usd,
    costSource: input.cost.source,
    fileBytes: byteCount,
    metadataAllowanceBytes,
    asset: input.asset ?? BASE_SEPOLIA_USDC,
    network: input.network ?? BASE_SEPOLIA_NETWORK,
    payTo: input.payTo ?? '',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    safetyMarginBps,
    mediaUsdcAmount: input.cost.mediaUsdcAmount,
    metadataUsdcAmount: input.cost.metadataUsdcAmount,
  };
}

export function contentHash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function newJob(quote: UploadQuote, payerAddress: string): UploadJob {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    idempotencyKey: quote.idempotencyKey,
    payerAddress: payerAddress.toLowerCase(),
    status: 'quoted',
    quote,
    payment: null,
    media: null,
    metadata: null,
    confirmation: null,
    credit: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

const PAID_STATUSES: UploadJob['status'][] = [
  'paid', 'uploading_media', 'uploading_metadata', 'confirming', 'confirmed', 'failed',
];

export function markReady(job: UploadJob, payment: UploadJob['payment']): UploadJob {
  if (PAID_STATUSES.includes(job.status) && job.payment) return job;
  return {
    ...job,
    status: 'paid',
    payment,
    updatedAt: new Date().toISOString(),
    errorMessage: null,
  };
}

/** @deprecated Use {@link markReady}. */
export const markPaid = markReady;

export function markMediaUploaded(job: UploadJob, media: NonNullable<UploadJob['media']>): UploadJob {
  if (job.status !== 'paid' && job.status !== 'uploading_media') {
    throw new Error(`Cannot upload media from ${job.status}`);
  }
  if (job.media?.id) return job;
  return { ...job, status: 'uploading_metadata', media, updatedAt: new Date().toISOString(), errorMessage: null };
}

export function markMetadataUploaded(job: UploadJob, metadata: NonNullable<UploadJob['metadata']>): UploadJob {
  if (!job.media) throw new Error('Upload media before metadata');
  if (job.metadata?.id) return job;
  return { ...job, status: 'confirming', metadata, updatedAt: new Date().toISOString(), errorMessage: null };
}

export function markConfirmed(job: UploadJob, confirmation: NonNullable<UploadJob['confirmation']>): UploadJob {
  if (!confirmation.mediaOk || !confirmation.metadataOk) {
    return {
      ...job,
      status: 'failed',
      confirmation,
      credit: null,
      errorMessage: 'Paid upload could not be retrieved from multiple gateways',
      updatedAt: new Date().toISOString(),
    };
  }
  return { ...job, status: 'confirmed', confirmation, credit: null, errorMessage: null, updatedAt: new Date().toISOString() };
}

export function failAfterPayment(job: UploadJob, reason: string): UploadJob {
  return {
    ...job,
    status: 'failed',
    credit: null,
    errorMessage: reason,
    updatedAt: new Date().toISOString(),
  };
}

export function mintEnabled(job: UploadJob) {
  return job.status === 'confirmed' && Boolean(job.metadata?.id);
}