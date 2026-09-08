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
  payTo: string;
  expiresAt: string;
  safetyMarginBps: number;
};

export type PaymentReceipt = {
  network: string;
  asset: string;
  amount: string;
  payer: string;
  payTo: string;
  settlementTx?: string;
  facilitator: string;
  status: 'verified' | 'settled' | 'mock';
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

export type X402Accepts = {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { idempotencyKey: string };
};

export type Facilitator = {
  verify(input: { paymentHeader: string; requirement: X402Accepts }): Promise<{ valid: boolean; payer?: string; error?: string }>;
  settle(input: { paymentHeader: string; requirement: X402Accepts }): Promise<{ success: boolean; txHash?: string; error?: string }>;
};

export type ArweaveAdapter = {
  upload(input: { bytes: Uint8Array; mimeType: string; tags?: Record<string, string> }): Promise<{ id: string; simulated?: boolean }>;
  retrieve(id: string): Promise<{ gateways: string[]; ok: boolean }>;
};
