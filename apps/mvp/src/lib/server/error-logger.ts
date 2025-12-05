import { getDatabase, errorLogs, type ErrorLogType } from '@cryptoart/db';

interface LogErrorOptions {
  type: ErrorLogType;
  message: string;
  stack?: string;
  userAddress?: string;
  listingId?: string;
  transactionHash?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error to the database for admin review.
 * This function is designed to never throw - errors during logging are caught and logged to console.
 * 
 * @param options - Error details to log
 */
export async function logError(options: LogErrorOptions): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.insert(errorLogs).values({
      type: options.type,
      message: options.message,
      stack: options.stack,
      userAddress: options.userAddress?.toLowerCase(),
      listingId: options.listingId,
      transactionHash: options.transactionHash,
      endpoint: options.endpoint,
      metadata: options.metadata,
    });
  } catch (error) {
    // Don't throw from error logger - just log to console
    console.error('[ErrorLogger] Failed to log error to database:', error);
    console.error('[ErrorLogger] Original error:', options);
  }
}

// Convenience functions for common error types

export const logTransactionError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'transaction_failed', message, ...opts });

export const logApiError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'api_error', message, ...opts });

export const logSubgraphError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'subgraph_error', message, ...opts });

export const logContractError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'contract_error', message, ...opts });

export const logWebhookError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'webhook_error', message, ...opts });

export const logUnknownError = (message: string, opts?: Partial<Omit<LogErrorOptions, 'type' | 'message'>>) =>
  logError({ type: 'unknown', message, ...opts });

/**
 * Helper to extract error details from an unknown error value.
 * Useful for catch blocks where error type is unknown.
 */
export function extractErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { message: String(error) };
}

