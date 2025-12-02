import { NextRequest, NextResponse } from 'next/server';
import { runNotificationWorker } from '~/lib/server/notification-worker';

/**
 * GET /api/cron/notifications
 * Vercel Cron Job endpoint for processing notifications
 * 
 * Configure in vercel.json with schedule "every minute"
 * See vercel.json for the actual cron configuration
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret if set (Vercel provides this)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Run the worker
    await runNotificationWorker();
    
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/notifications] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

