"use client";

import { AlertCircle } from "lucide-react";

/**
 * FarcasterPrompt component displays a message when the app is accessed outside of Farcaster.
 * 
 * This component is shown when users try to access the app in a regular browser instead of
 * through the Farcaster mini app interface. It provides clear instructions on how to access
 * the app properly.
 * 
 * @example
 * ```tsx
 * <FarcasterPrompt />
 * ```
 */
export function FarcasterPrompt() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        {/* Icon */}
        <div className="mb-6">
          <AlertCircle className="h-16 w-16 mx-auto text-blue-500" />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Access via Farcaster
        </h1>
        
        {/* Description */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          This app is designed to work within Farcaster. Please navigate to this app 
          through the Farcaster mobile app to access all features.
        </p>
        
        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">How to access:</h3>
          <ol className="text-left text-blue-800 text-sm space-y-1">
            <li>1. Open the Farcaster mobile app</li>
            <li>2. Find this app in the mini apps section</li>
            <li>3. Tap to launch the app</li>
          </ol>
        </div>
        
        {/* Footer */}
        <div className="text-xs text-gray-500">
          <p>Need help? Check the Farcaster app for mini apps.</p>
        </div>
      </div>
    </div>
  );
}
