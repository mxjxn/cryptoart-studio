import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, userCache, sql } from '@cryptoart/db';
import { calculateUserStats, saveUserStats } from '~/lib/server/user-stats-calculator';

/**
 * GET /api/cron/calculate-user-stats
 * Calculate and cache user statistics for all users
 * 
 * Query params:
 * - address: Optional specific user address to calculate
 * - batch: Batch size for processing (default: 100)
 * - offset: Offset for pagination (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const specificAddress = searchParams.get('address');
    const batchSize = parseInt(searchParams.get('batch') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const db = getDatabase();
    const startTime = Date.now();
    
    // If specific address provided, calculate only for that user
    if (specificAddress) {
      console.log(`[Cron] Calculating stats for specific user: ${specificAddress}`);
      const stats = await calculateUserStats(specificAddress);
      await saveUserStats(stats);
      
      return NextResponse.json({
        success: true,
        message: 'Stats calculated for user',
        userAddress: specificAddress,
        duration: Date.now() - startTime,
      });
    }
    
    // Otherwise, process batch of users from userCache
    const users = await db
      .select({ ethAddress: userCache.ethAddress })
      .from(userCache)
      .limit(batchSize)
      .offset(offset);
    
    console.log(`[Cron] Processing batch of ${users.length} users (offset: ${offset})`);
    
    const results = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ address: string; error: string }>,
    };
    
    // Process users in parallel (batches of 10 to avoid overwhelming the subgraph)
    const chunks = [];
    for (let i = 0; i < users.length; i += 10) {
      chunks.push(users.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (user) => {
          try {
            const stats = await calculateUserStats(user.ethAddress);
            await saveUserStats(stats);
            results.successful++;
          } catch (error) {
            console.error(`[Cron] Error calculating stats for ${user.ethAddress}:`, error);
            results.failed++;
            results.errors.push({
              address: user.ethAddress,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Cron] Batch complete: ${results.successful} successful, ${results.failed} failed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'User stats calculated',
      results,
      duration,
      nextOffset: offset + batchSize,
    });
  } catch (error) {
    console.error('[Cron] Error in calculate-user-stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate user stats',
      },
      { status: 500 }
    );
  }
}
