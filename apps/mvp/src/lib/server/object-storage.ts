/**
 * Shared object storage for thumbnails, IPFS image cache, and other blobs.
 *
 * Priority on VPS / production:
 *   1. Cloudflare R2 / S3 (R2_BUCKET or S3_BUCKET)
 *   2. Vercel Blob (legacy; only if BLOB_READ_WRITE_TOKEN is set)
 *   3. Local filesystem (development only)
 */

export interface ObjectStorageBackend {
  upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
  getUrl(key: string): string;
}

class LocalStorageBackend implements ObjectStorageBackend {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = '/tmp/thumbnails', baseUrl: string = '/api/thumbnails') {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    void contentType;
    return `${this.baseUrl}/${key}`;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

class VercelBlobBackend implements ObjectStorageBackend {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BLOB_READ_URL || '';
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob Storage');
    }

    try {
      // @ts-ignore - optional dependency
      const { put } = await import('@vercel/blob');
      const blob = await put(key, buffer, {
        access: 'public',
        contentType,
        allowOverwrite: true,
      });
      return blob.url;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Cannot find module') || error.message.includes("Can't resolve")) {
          throw new Error('@vercel/blob is not installed. Prefer R2_BUCKET on the VPS.');
        }
        if (error.message.includes('already exists') || error.message.includes('This blob already exists')) {
          return this.getUrl(key);
        }
        throw new Error(`Vercel Blob upload failed: ${error.message}`);
      }
      throw new Error('Vercel Blob upload failed: Unknown error');
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/${key}`;
  }
}

class S3CompatibleBackend implements ObjectStorageBackend {
  private bucket: string;
  private region: string;
  private endpoint?: string;
  private baseUrl: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || '';
    this.region = process.env.S3_REGION || process.env.R2_REGION || 'auto';
    this.endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
    this.accessKeyId =
      process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

    // Public URL for browsers (R2 custom domain / public bucket URL). Never use the API endpoint.
    const publicUrl =
      process.env.R2_PUBLIC_URL ||
      process.env.S3_PUBLIC_URL ||
      process.env.BLOB_READ_URL;

    if (publicUrl) {
      this.baseUrl = publicUrl.replace(/\/$/, '');
    } else if (this.endpoint && process.env.R2_BUCKET) {
      // Fallback: account-scoped R2 public.dev URL pattern is not universal; warn.
      console.warn(
        '[object-storage] R2_PUBLIC_URL is not set; uploads may return non-public API endpoint URLs',
      );
      this.baseUrl = this.endpoint.replace(/\/$/, '');
    } else if (this.bucket && !this.endpoint) {
      this.baseUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    } else {
      this.baseUrl = this.endpoint?.replace(/\/$/, '') || '';
    }
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: Boolean(this.endpoint),
      credentials: this.accessKeyId
        ? {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey || '',
          }
        : undefined,
    });

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=2592000',
      }),
    );

    return this.getUrl(key);
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}

export function createLocalObjectStorage(): ObjectStorageBackend {
  return new LocalStorageBackend();
}

/**
 * Resolve the active object storage backend from env.
 * Returns null when production has no usable backend configured.
 */
export function getObjectStorageBackend(): ObjectStorageBackend | null {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (process.env.S3_BUCKET || process.env.R2_BUCKET) {
    return new S3CompatibleBackend();
  }

  if (
    process.env.BLOB_READ_WRITE_TOKEN &&
    (!isDevelopment || process.env.FORCE_VERCEL_BLOB === 'true')
  ) {
    return new VercelBlobBackend();
  }

  if (isDevelopment) {
    return new LocalStorageBackend();
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.S3_BUCKET && !process.env.R2_BUCKET) {
    console.warn(
      '[object-storage] No backend configured. Set R2_BUCKET (preferred on VPS) or S3_BUCKET.',
    );
  }

  return null;
}

export function requireObjectStorageBackend(): ObjectStorageBackend {
  const storage = getObjectStorageBackend();
  if (storage) return storage;

  if (process.env.NODE_ENV === 'development') {
    return createLocalObjectStorage();
  }

  throw new Error(
    'No object storage configured. Set R2_BUCKET (+ R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL) for the VPS.',
  );
}
