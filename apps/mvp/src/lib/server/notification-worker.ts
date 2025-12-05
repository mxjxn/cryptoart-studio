import { processEventsSince } from './notification-events';
import { flushAllNotificationBatches } from './neynar-notifications';
import { getDatabase, notificationWorkerState } from '@cryptoart/db';
import { eq } from '@cryptoart/db';

/**
 * Get the last processed block number from worker state table
 */
async function getLastProcessedBlock(): Promise<number> {
  const db = getDatabase();
  
  const [state] = await db.select()
    .from(notificationWorkerState)
    .orderBy(notificationWorkerState.id)
    .limit(1);
  
  if (state) {
    return state.lastProcessedBlock;
  }
  
  // Default to 1 hour ago (assuming ~2 second blocks on Base)
  // This will be set after first successful run
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  return oneHourAgo;
}

/**
 * Get the last processed timestamp from worker state table
 */
async function getLastProcessedTimestamp(): Promise<number> {
  const db = getDatabase();
  
  const [state] = await db.select()
    .from(notificationWorkerState)
    .orderBy(notificationWorkerState.id)
    .limit(1);
  
  if (state) {
    return state.lastProcessedTimestamp;
  }
  
  // Default to 1 hour ago
  // This will be set after first successful run
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  return oneHourAgo;
}

/**
 * Update worker state with last processed block and timestamp
 */
async function updateWorkerState(block: number, timestamp: number): Promise<void> {
  const db = getDatabase();
  
  const [existing] = await db.select()
    .from(notificationWorkerState)
    .orderBy(notificationWorkerState.id)
    .limit(1);
  
  if (existing) {
    // Update existing state
    await db.update(notificationWorkerState)
      .set({
        lastProcessedBlock: block,
        lastProcessedTimestamp: timestamp,
        updatedAt: new Date(),
      })
      .where(eq(notificationWorkerState.id, existing.id));
  } else {
    // Create initial state
    await db.insert(notificationWorkerState).values({
      lastProcessedBlock: block,
      lastProcessedTimestamp: timestamp,
      updatedAt: new Date(),
    });
  }
}

/**
 * Main worker function to process new events
 * This should be called periodically (e.g., every minute via cron)
 */
export async function runNotificationWorker(): Promise<void> {
  console.log('[notification-worker] Starting notification worker...');
  
  try {
    const lastBlock = await getLastProcessedBlock();
    const lastTimestamp = await getLastProcessedTimestamp();
    
    console.log(`[notification-worker] Processing events since block ${lastBlock}, timestamp ${lastTimestamp}`);
    
    // Process events - this will create notifications
    // Track the latest processed timestamp from events
    let latestProcessedTimestamp = lastTimestamp;
    
    try {
      await processEventsSince(lastBlock, lastTimestamp);
      
      // Flush all batched push notifications
      // This sends all queued notifications in optimized batches to reduce API calls
      await flushAllNotificationBatches();
      
      // Update worker state with current timestamp (events processed up to now)
      // This ensures we don't reprocess the same events on next run
      const currentTimestamp = Math.floor(Date.now() / 1000);
      latestProcessedTimestamp = currentTimestamp;
      
      // For block, we'll use timestamp as approximation (subgraph uses timestamps)
      // In production, you might want to track actual block numbers from subgraph
      await updateWorkerState(lastBlock, currentTimestamp);
    } catch (error) {
      // On error, still try to flush any queued notifications
      try {
        await flushAllNotificationBatches();
      } catch (flushError) {
        console.error('[notification-worker] Error flushing notifications:', flushError);
      }
      
      // On error, still update state to avoid infinite retry loops
      // But log the error for monitoring
      console.error('[notification-worker] Error processing events, updating state anyway:', error);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      await updateWorkerState(lastBlock, currentTimestamp);
      throw error;
    }
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log('[notification-worker] Notification worker completed successfully');
    console.log(`[notification-worker] Updated state: block=${lastBlock}, timestamp=${currentTimestamp}`);
  } catch (error) {
    console.error('[notification-worker] Error in notification worker:', error);
    // Don't update state on error - will retry from same point
    throw error;
  }
}

