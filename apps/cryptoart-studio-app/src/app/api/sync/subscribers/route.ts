import { NextRequest, NextResponse } from 'next/server';
import { hypersubCache } from '@cryptoart/cache';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting background sync for subscribers...');

    // Clean up expired subscriber cache entries
    await hypersubCache.cleanupExpiredEntries();

    console.log('Background sync for subscribers completed');

    return NextResponse.json({ 
      success: true, 
      message: 'Subscriber cache cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Background sync error:', error);
    return NextResponse.json(
      { error: 'Background sync failed' },
      { status: 500 }
    );
  }
}
