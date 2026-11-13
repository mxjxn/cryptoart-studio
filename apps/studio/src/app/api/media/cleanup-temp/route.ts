import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

/**
 * Cleanup expired temporary uploads.
 * This cron job deletes Blob files that:
 * 1. Are in the temp/ prefix
 * 2. Are older than the configured TTL
 * 3. Were never promoted to Arweave (not tracked in the media database)
 * 
 * Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 },
      );
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const ttlSeconds = process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS
      ? parseInt(process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS, 10)
      : 604800; // 7 days default

    const expirationTime = Date.now() - ttlSeconds * 1000;
    
    // List all temp uploads
    const blobs = await list({
      prefix: 'temp/',
    });

    const toDelete: string[] = [];
    for (const blob of blobs.blobs) {
      const uploadedAt = new Date(blob.uploadedAt).getTime();
      if (uploadedAt < expirationTime) {
        toDelete.push(blob.url);
      }
    }

    // Delete expired blobs
    if (toDelete.length > 0) {
      await del(toDelete);
    }

    return NextResponse.json({
      success: true,
      deletedCount: toDelete.length,
      checkedCount: blobs.blobs.length,
      ttlSeconds,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
