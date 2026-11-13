import type { UploadJob, UploadQuote, FileQuoteInput, ArweaveRecord } from './types';

export interface TempUploadResult {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
}

export interface MetadataInput {
  name: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  animation_url?: string;
  animationUrl?: string;
}

export interface ConfirmResult {
  job: UploadJob;
  mintEnabled: boolean;
}

export interface JobStatusResult {
  job: UploadJob;
  mintEnabled: boolean;
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
   * Upload a file to temporary storage (Vercel Blob).
   * Returns a signed URL valid for 1 hour.
   */
  async uploadTemp(file: File): Promise<TempUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.options.baseUrl}/temp-upload`;
    const response = await this.fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(body.error || `Upload failed with status ${response.status}`);
    }

    return response.json();
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
