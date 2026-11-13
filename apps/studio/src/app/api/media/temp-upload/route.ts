import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { toPlatformRequest, createIdentityRouter, createPostgresIdentityStore, createMemoryIdentityStore } from '@cryptoart/identity';

const postgresUrl = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;

const identity = createIdentityRouter({
  store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
  ownerAddress: process.env.CRYPTOART_OWNER_ADDRESS,
  secureCookies: process.env.NODE_ENV === 'production',
});

// Legacy route: restricted to 4 MB to stay under Vercel function body limit
// For larger files, use /api/media/temp-upload/token with client-side upload
const MAX_FILE_SIZE_LEGACY = 4 * 1024 * 1024; // 4 MB

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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (legacy route has lower limit)
    if (file.size > MAX_FILE_SIZE_LEGACY) {
      return NextResponse.json(
        { error: `File too large for legacy upload. Maximum size is ${MAX_FILE_SIZE_LEGACY / 1024 / 1024} MB. Use client-side upload for larger files.` },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
      return NextResponse.json(
        { error: `File type not supported: ${file.type}. Allowed types: images, video, audio, 3D models` },
        { status: 400 },
      );
    }

    // Sanitize filename: use random ID + safe extension
    const randomId = crypto.randomUUID();
    const safeExtension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const pathname = `temp/${payer}/${Date.now()}-${randomId}.${safeExtension}`;

    // Upload to Vercel Blob with expiration
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      cacheControlMaxAge: TEMP_UPLOAD_TTL_SECONDS,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      contentType: blob.contentType,
      expiresAt: new Date(Date.now() + TEMP_UPLOAD_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Temp upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
