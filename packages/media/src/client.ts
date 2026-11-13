import type { 
  UploadJob, 
  UploadQuote, 
  FileQuoteInput, 
  ArweaveRecord,
  TempUploadResult,
  MetadataInput,
  ConfirmResult,
  JobStatusResult,
} from './types';

export interface MediaConfig {
  allowMockPayment: boolean;
  hasTurbo: boolean;
  hasFacilitator: boolean;
  network: string | null;
  uploaderType: string;
  maxFileSize: number;
  maxFileSizeMB: number;
  tempUploadTtlSeconds: number;
}

export class MediaClient {
  constructor(
    private options: {
      baseUrl: string;
      fetch?: typeof fetch;
    },
  ) {}

  private get fetch(): typeof fetch {
    return this.options.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.options.baseUrl}${path}`;
    const response = await this.fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(body.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get media backend configuration (max file size, uploader type, etc.)
   */
  async getConfig(): Promise<MediaConfig> {
    return this.request<MediaConfig>('/config', { method: 'GET' });
  }

  /**
   * Calculate estimated Arweave cost for a file size.
   * @param sizeBytes - File size in bytes
   * @returns Estimated cost in USDC (approximate, for preview only)
   */
  estimateCost(sizeBytes: number): string {
    const WINSTON_PER_BYTE = 100000n;
    const safetyMarginBps = 500;
    const winston = BigInt(sizeBytes) * WINSTON_PER_BYTE;
    const withMargin = winston + (winston * BigInt(safetyMarginBps)) / 10000n;
    const ar = Number(withMargin) / 1e12;
    const usd = Math.max(ar * 8, 0.01);
    const usdc = BigInt(Math.ceil(usd * 1e6));
    return (Number(usdc) / 1e6).toFixed(2);
  }

  /**
   * Upload a file to temporary storage (Vercel Blob) using client-side upload.
   * Returns a signed URL with expiration time.
   * Check config.maxFileSize before calling to avoid rejection.
   */
  async uploadTemp(file: File): Promise<TempUploadResult> {
    // Import @vercel/blob/client dynamically to support both browser and Node.js
    const { upload } = await import('@vercel/blob/client');

    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: `${this.options.baseUrl}/temp-upload/token`,
      clientPayload: JSON.stringify({
        type: file.type,
        name: file.name,
      }),
    });

    // Calculate expiration from config
    const config = await this.getConfig();
    const expiresAt = new Date(Date.now() + config.tempUploadTtlSeconds * 1000).toISOString();

    return {
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      contentType: blob.contentType || file.type,
      expiresAt,
    };
  }

  /**
   * Get a quote for uploading files to Arweave.
   * Returns a 402 Payment Required response with quote details.
   */
  async quote(files: FileQuoteInput[], idempotencyKey?: string): Promise<{ quote: UploadQuote }> {
    const response = await this.request<{ quote: UploadQuote }>('/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, idempotencyKey }),
    });
    return response;
  }

  /**
   * Create a paid upload job.
   * @param idempotencyKey - The quote idempotency key
   * @param paymentHeader - Payment proof (e.g., 'mock:allow' for testing)
   */
  async createJob(idempotencyKey: string, paymentHeader: string): Promise<{ job: UploadJob; replayed?: boolean }> {
    return this.request<{ job: UploadJob; replayed?: boolean }>('/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': paymentHeader,
      },
      body: JSON.stringify({ idempotencyKey }),
    });
  }

  /**
   * Upload media bytes to Arweave.
   * @param jobId - The job ID
   * @param bytes - File bytes as Uint8Array or base64 string
   */
  async uploadMedia(
    jobId: string,
    bytes: Uint8Array | string,
  ): Promise<{ job: UploadJob; simulated: boolean }> {
    const base64 = typeof bytes === 'string' ? bytes : this.bytesToBase64(bytes);
    return this.request<{ job: UploadJob; simulated: boolean }>(`/jobs/${jobId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes: base64 }),
    });
  }

  /**
   * Generate and upload metadata JSON to Arweave.
   * @param jobId - The job ID
   * @param metadata - Metadata fields (name, description, attributes, etc.)
   */
  async uploadMetadata(
    jobId: string,
    metadata: MetadataInput,
  ): Promise<{ job: UploadJob; metadata: Record<string, unknown>; simulated: boolean }> {
    return this.request<{ job: UploadJob; metadata: Record<string, unknown>; simulated: boolean }>(
      `/jobs/${jobId}/metadata`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
    );
  }

  /**
   * Confirm that media and metadata are retrievable from Arweave gateways.
   * @param jobId - The job ID
   */
  async confirm(jobId: string): Promise<ConfirmResult> {
    return this.request<ConfirmResult>(`/jobs/${jobId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  /**
   * Get the current status of an upload job.
   * @param jobId - The job ID
   */
  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    return this.request<JobStatusResult>(`/jobs/${jobId}`, {
      method: 'GET',
    });
  }

  /**
   * Helper to hash file bytes as SHA-256 hex string.
   */
  async hashFile(file: File): Promise<string> {
    const bytes = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Helper to convert bytes to base64 string.
   */
  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, len)));
    }
    return btoa(binary);
  }
}

/**
 * Helper to get a fully qualified token URI from an Arweave metadata transaction ID.
 */
export function tokenUriFromMetadata(metadata: ArweaveRecord | { id: string }): string {
  return `ar://${metadata.id}`;
}

/**
 * Helper to get Arweave gateway URLs for a transaction ID.
 */
export function arweaveGatewayUrls(txId: string): string[] {
  return [
    `https://arweave.net/${txId}`,
    `https://ar-io.net/${txId}`,
  ];
}
