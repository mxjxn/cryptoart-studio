export const UPLOAD_JOB_STATUSES = [
  'quoted',
  'payment_required',
  'paid',
  'uploading_media',
  'uploading_metadata',
  'confirming',
  'confirmed',
  'failed',
  'credit_owed',
  'refunded',
] as const;

export type UploadJobStatus = (typeof UPLOAD_JOB_STATUSES)[number];

export type FileQuoteInput = {
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
};

export type UploadQuote = {
  idempotencyKey: string;
  files: FileQuoteInput[];
  byteCount: number;
  arweaveWinston: string;
  usdcAmount: string;
  asset: string;
  network: string;
  /** Legacy field; treasury settlement removed. Empty on new quotes. */
  payTo: string;
  expiresAt: string;
  safetyMarginBps: number;
  /** Combined USD estimate for both Turbo x402 uploads. */
  usd: number;
  usdcDisplay: string;
  costSource: 'turbo';
  fileBytes: number;
  metadataAllowanceBytes: number;
  /** Per-upload Turbo x402 estimates (atomic USDC). */
  mediaUsdcAmount?: string;
  metadataUsdcAmount?: string;
};

export type PaymentReceipt = {
  network: string;
  asset: string;
  amount: string;
  payer: string;
  payTo: string;
  settlementTx?: string;
  facilitator: 'turbo-x402' | 'mock' | 'http';
  status: 'settled' | 'mock';
};

export type ArweaveRecord = {
  id: string;
  sha256: string;
  mimeType: string;
  size: number;
  gateways: string[];
};

export type UploadJob = {
  id: string;
  idempotencyKey: string;
  payerAddress: string;
  status: UploadJobStatus;
  quote: UploadQuote;
  payment: PaymentReceipt | null;
  media: ArweaveRecord | null;
  metadata: ArweaveRecord | null;
  confirmation: { mediaOk: boolean; metadataOk: boolean; checkedAt: string } | null;
  credit: { reason: string; amount: string } | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArweaveAdapter = {
  upload(input: { bytes: Uint8Array; mimeType: string; tags?: Record<string, string> }): Promise<{ id: string; simulated?: boolean }>;
  retrieve(id: string): Promise<{ gateways: string[]; ok: boolean }>;
};
