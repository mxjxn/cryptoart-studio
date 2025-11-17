"use client";

import { useMiniApp } from "@neynar/react";

/**
 * ContextTab component displays the current mini app context in JSON format.
 * 
 * This component provides a developer-friendly view of the Farcaster mini app context,
 * including user information, client details, and other contextual data. It's useful
 * for debugging and understanding what data is available to the mini app.
 * 
 * The context includes:
 * - User information (FID, username, display name, profile picture)
 * - Client information (safe area insets, platform details)
 * - Mini app configuration and state
 * 
 * @example
 * ```tsx
 * <ContextTab />
 * ```
 */
export function ContextTab() {
  let context;
  let error: Error | null = null;

  try {
    const miniApp = useMiniApp();
    context = miniApp.context;
  } catch (err) {
    error = err instanceof Error ? err : new Error('Failed to get mini app context');
  }

  if (error) {
    return (
      <div className="mx-6">
        <h2 className="text-lg font-semibold mb-2">Context</h2>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 mb-2">
            Error loading context: {error.message}
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            Please open this mini app in Farcaster to view context information.
          </p>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="mx-6">
        <h2 className="text-lg font-semibold mb-2">Context</h2>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-200">
            No context available. Please open this mini app in Farcaster.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mx-6">
      <h2 className="text-lg font-semibold mb-2">Context</h2>
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <pre className="font-mono text-xs whitespace-pre-wrap break-words w-full">
          {JSON.stringify(context, null, 2)}
        </pre>
      </div>
    </div>
  );
} 