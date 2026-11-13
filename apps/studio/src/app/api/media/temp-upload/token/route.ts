import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { toPlatformRequest, createIdentityRouter, createPostgresIdentityStore, createMemoryIdentityStore } from '@cryptoart/identity';

const postgresUrl = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;

const identity = createIdentityRouter({
  store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
  ownerAddress: process.env.CRYPTOART_OWNER_ADDRESS,
  secureCookies: process.env.NODE_ENV === 'production',
});

// Configurable max file size (default 100 MB)
const MAX_FILE_SIZE = process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE
  ? parseInt(process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE, 10)
  : 100 * 1024 * 1024;

// Temp uploads expire after this duration (default 7 days)
const TEMP_UPLOAD_TTL_SECONDS = process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS
  ? parseInt(process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS, 10)
  : 604800;

const ALLOWED_MIME_TYPES = [
  // Images (no SVG or HTML for security)
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // Audio
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  // 3D/Interactive
  'model/gltf-binary',
  'model/gltf+json',
  // Generic fallbacks
  'application/octet-stream',
];

function headerRecord(req: NextRequest) {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * Handle client-side uploads to Vercel Blob.
 * This uses handleUpload to process uploads initiated by the client.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Check authentication
        const url = new URL(req.url);
        const session = await identity.handle(
          toPlatformRequest({
            method: 'GET',
            url: new URL('/session', url.origin),
            headers: headerRecord(req),
            body: {},
          }),
        );

        if (session.status !== 200) {
          throw new Error('Authentication required');
        }

        const payer = (session.body as { address?: string }).address;
        if (!payer) {
          throw new Error('No wallet address in session');
        }

        // Validate content type from client payload
        const contentType = (clientPayload as any)?.type;
        if (!contentType || (!ALLOWED_MIME_TYPES.includes(contentType) && contentType !== '')) {
          throw new Error(`Content type not supported: ${contentType}`);
        }

        // Generate a sanitized pathname
        const randomId = crypto.randomUUID();
        const fileName = (clientPayload as any)?.name || 'file';
        const safeExtension = fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
        
        return {
          allowedContentTypes: [contentType],
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({
            payer,
            uploadedAt: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Log or track the upload
        console.log('Upload completed:', blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Client upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}

export const dynamic = 'force-dynamic';
