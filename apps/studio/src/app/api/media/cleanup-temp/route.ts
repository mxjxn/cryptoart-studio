import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

/**
 * Cleanup expired temporary uploads.
 * This cron job deletes all Blob files in the temp/ prefix that are older than the configured TTL.
 * 
 * Protected by CRON_SECRET.
 */
async function cleanupTempBlobs(req: NextRequest) {
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
    
    let totalDeleted = 0;
    let totalChecked = 0;
    let cursor: string | undefined;

    // Paginate through all temp uploads
    do {
      const result = await list({
        prefix: 'temp/',
        cursor,
      });

      const toDelete: string[] = [];
      for (const blob of result.blobs) {
        totalChecked++;
        const uploadedAt = new Date(blob.uploadedAt).getTime();
        if (uploadedAt < expirationTime) {
          toDelete.push(blob.url);
        }
      }

      // Delete expired blobs
      if (toDelete.length > 0) {
        await del(toDelete);
        totalDeleted += toDelete.length;
      }

      cursor = result.cursor;
    } while (cursor);

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      checkedCount: totalChecked,
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

export async function GET(req: NextRequest) {
  return cleanupTempBlobs(req);
}

export async function POST(req: NextRequest) {
  return cleanupTempBlobs(req);
}

export const dynamic = 'force-dynamic';
