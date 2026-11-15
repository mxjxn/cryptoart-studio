import { createHash, randomBytes } from 'node:crypto';
import { formatUsdc, METADATA_ALLOWANCE_BYTES, usdcAtomicFromUsd, withSafetyMargin, type UploadCost } from './quote';
import type { FileQuoteInput, UploadJob, UploadQuote } from './types';

export const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_SEPOLIA_NETWORK = 'eip155:84532';
export const BASE_NETWORK = 'eip155:8453';

export function quoteUpload(input: {
  files: FileQuoteInput[];
  payTo: string;
  cost: UploadCost;
  network?: string;
  asset?: string;
  safetyMarginBps?: number;
  idempotencyKey?: string;
  metadataAllowanceBytes?: number;
}): UploadQuote {
  if (!input.files.length) throw new Error('At least one file is required');
  if (input.files.some((file) => !Number.isInteger(file.size) || file.size <= 0)) {
    throw new Error('Each file needs a positive size');
  }
  const byteCount = input.files.reduce((sum, file) => sum + file.size, 0);
  const safetyMarginBps = input.safetyMarginBps ?? 500;
  const usdcAmount = usdcAtomicFromUsd(input.cost.usd, safetyMarginBps);
  const metadataAllowanceBytes = input.metadataAllowanceBytes ?? METADATA_ALLOWANCE_BYTES;
  return {
    idempotencyKey: input.idempotencyKey ?? randomBytes(16).toString('hex'),
    files: input.files,
    byteCount,
    arweaveWinston: withSafetyMargin(BigInt(input.cost.winston), safetyMarginBps).toString(),
    usdcAmount,
    usdcDisplay: formatUsdc(usdcAmount),
    usd: input.cost.usd,
    costSource: input.cost.source,
    fileBytes: byteCount,
    metadataAllowanceBytes,
    asset: input.asset ?? BASE_SEPOLIA_USDC,
    network: input.network ?? BASE_SEPOLIA_NETWORK,
    payTo: input.payTo,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    safetyMarginBps,
  };
}

export function contentHash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function x402PaymentRequired(quote: UploadQuote, domain?: { name: string; version: string }) {
  return {
    x402Version: 2,
    error: 'Payment required',
    accepts: [{
      scheme: 'exact' as const,
      network: quote.network,
      amount: quote.usdcAmount,
      asset: quote.asset,
      payTo: quote.payTo,
      maxTimeoutSeconds: 90,
      extra: {
        idempotencyKey: quote.idempotencyKey,
        name: domain?.name ?? 'USDC',
        version: domain?.version ?? '2',
      },
    }],
  };
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
  'paid', 'uploading_media', 'uploading_metadata', 'confirming', 'confirmed', 'credit_owed', 'refunded',
];

export function markPaid(job: UploadJob, payment: NonNullable<UploadJob['payment']>): UploadJob {
  if (PAID_STATUSES.includes(job.status) && job.payment) return job;
  return { ...job, status: 'paid', payment, updatedAt: new Date().toISOString(), errorMessage: null };
}

export function markMediaUploaded(job: UploadJob, media: NonNullable<UploadJob['media']>): UploadJob {
  if (job.status !== 'paid' && job.status !== 'uploading_media' && job.status !== 'credit_owed') {
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
      status: 'credit_owed',
      confirmation,
      credit: { reason: 'Arweave retrieval failed after payment', amount: job.quote.usdcAmount },
      errorMessage: 'Paid upload could not be retrieved from multiple gateways',
      updatedAt: new Date().toISOString(),
    };
  }
  return { ...job, status: 'confirmed', confirmation, credit: null, errorMessage: null, updatedAt: new Date().toISOString() };
}

export function failAfterPayment(job: UploadJob, reason: string): UploadJob {
  if (!job.payment) throw new Error('Cannot create a credit without payment');
  return {
    ...job,
    status: 'credit_owed',
    credit: { reason, amount: job.quote.usdcAmount },
    errorMessage: reason,
    updatedAt: new Date().toISOString(),
  };
}

export function mintEnabled(job: UploadJob) {
  return job.status === 'confirmed' && Boolean(job.metadata?.id);
}
