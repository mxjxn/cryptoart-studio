import { NextRequest, NextResponse } from 'next/server';
import { createUploadToken } from '@vercel/blob/client';
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
 * Generate a client upload token for Vercel Blob uploads.
 * This allows client-side uploads without proxying through the function.
 */
export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payer = (session.body as { address?: string }).address;
    if (!payer) {
      return NextResponse.json({ error: 'No wallet address in session' }, { status: 401 });
    }

    // Parse request body for validation params
    const body = await req.json().catch(() => ({}));
    const { contentType, fileName } = body;

    // Validate content type
    if (!contentType || (!ALLOWED_MIME_TYPES.includes(contentType) && contentType !== '')) {
      return NextResponse.json(
        { error: `Content type not supported: ${contentType}. Allowed types: images, video, audio, 3D models` },
        { status: 400 },
      );
    }

    // Generate upload token with constraints
    const token = await createUploadToken(
      {
        pathname: `temp/${payer}/${Date.now()}-${fileName || 'file'}`,
        allowedContentTypes: [contentType],
        maximumSizeInBytes: MAX_FILE_SIZE,
        validUntil: Date.now() + 60 * 1000, // Token valid for 1 minute
      },
      {
        access: 'public',
        cacheControlMaxAge: TEMP_UPLOAD_TTL_SECONDS,
        addRandomSuffix: true,
      },
    );

    return NextResponse.json({
      token,
      maxFileSize: MAX_FILE_SIZE,
      ttlSeconds: TEMP_UPLOAD_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token generation failed' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
