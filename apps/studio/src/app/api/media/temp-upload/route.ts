import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { toPlatformRequest, createIdentityRouter, createPostgresIdentityStore, createMemoryIdentityStore } from '@cryptoart/identity';

const postgresUrl = process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;

const identity = createIdentityRouter({
  store: postgresUrl ? createPostgresIdentityStore(postgresUrl) : createMemoryIdentityStore(),
  ownerAddress: process.env.CRYPTOART_OWNER_ADDRESS,
  secureCookies: process.env.NODE_ENV === 'production',
});

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
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
  'text/html',
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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
      return NextResponse.json(
        { error: `File type not supported: ${file.type}. Allowed types: images, video, audio, HTML, 3D models` },
        { status: 400 },
      );
    }

    // Upload to Vercel Blob
    const blob = await put(`temp/${payer}/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      contentType: blob.contentType,
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
