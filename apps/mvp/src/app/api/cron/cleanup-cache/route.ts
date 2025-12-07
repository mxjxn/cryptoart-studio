import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, userCache, contractCache, imageCache, notifications, lt, and, lte, eq } from '@cryptoart/db';

/**
 * GET /api/cron/cleanup-cache
 * Vercel Cron Job endpoint for cleaning up expired cache entries
 * 
 * This cron job prevents unbounded table growth by removing:
 * - Expired user cache entries (older than 30 days)
 * - Expired contract cache entries (older than 30 days)
 * - Expired image cache entries (older than 3 days)
 * - Old read notifications (older than 90 days)
 * 
 * Expected Impact: Prevents disk IO from growing unbounded over time
 * Recommended Schedule: Daily (configure in vercel.json)
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
    
    const db = getDatabase();
    const startTime = Date.now();
    const results: Record<string, number> = {};

    // 1. Clean up expired user cache entries (older than expiration date)
    try {
      const deletedUsers = await db
        .delete(userCache)
        .where(lt(userCache.expiresAt, new Date()))
        .returning({ id: userCache.ethAddress });
      
      results.deletedUserCache = deletedUsers.length;
      console.log(`[cron/cleanup-cache] Deleted ${deletedUsers.length} expired user cache entries`);
    } catch (error) {
      console.error('[cron/cleanup-cache] Error cleaning user cache:', error);
      results.deletedUserCache = 0;
    }

    // 2. Clean up expired contract cache entries
    try {
      const deletedContracts = await db
        .delete(contractCache)
        .where(lt(contractCache.expiresAt, new Date()))
        .returning({ id: contractCache.contractAddress });
      
      results.deletedContractCache = deletedContracts.length;
      console.log(`[cron/cleanup-cache] Deleted ${deletedContracts.length} expired contract cache entries`);
    } catch (error) {
      console.error('[cron/cleanup-cache] Error cleaning contract cache:', error);
      results.deletedContractCache = 0;
    }

    // 3. Clean up expired image cache entries
    try {
      const deletedImages = await db
        .delete(imageCache)
        .where(lt(imageCache.expiresAt, new Date()))
        .returning({ id: imageCache.imageUrl });
      
      results.deletedImageCache = deletedImages.length;
      console.log(`[cron/cleanup-cache] Deleted ${deletedImages.length} expired image cache entries`);
    } catch (error) {
      console.error('[cron/cleanup-cache] Error cleaning image cache:', error);
      results.deletedImageCache = 0;
    }

    // 4. Clean up old read notifications (older than 90 days)
    // Keep unread notifications indefinitely so users don't miss important notifications
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedNotifications = await db
        .delete(notifications)
        .where(and(
          lte(notifications.createdAt, ninetyDaysAgo),
          eq(notifications.read, true)
        ))
        .returning({ id: notifications.id });
      
      results.deletedNotifications = deletedNotifications.length;
      console.log(`[cron/cleanup-cache] Deleted ${deletedNotifications.length} old read notifications`);
    } catch (error) {
      console.error('[cron/cleanup-cache] Error cleaning notifications:', error);
      results.deletedNotifications = 0;
    }

    const elapsed = Date.now() - startTime;
    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);
    
    console.log(`[cron/cleanup-cache] Cleanup completed in ${elapsed}ms, total deleted: ${totalDeleted}`);
    
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      elapsed: `${elapsed}ms`,
      results,
      totalDeleted,
    });
  } catch (error) {
    console.error('[cron/cleanup-cache] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
