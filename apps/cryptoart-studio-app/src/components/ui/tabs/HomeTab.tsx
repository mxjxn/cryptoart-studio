"use client";

import { BarChart3, Users, Settings, Package } from "lucide-react";

/**
 * HomeTab component displays the main landing content for the mini app.
 * 
 * This is the default tab that users see when they first open the mini app.
 * It provides navigation to the Creator Studio Dashboard and other features.
 * 
 * @example
 * ```tsx
 * <HomeTab />
 * ```
 */
export function HomeTab() {
  const handleNavigate = (path: string) => {
    // Use window.location for reliable navigation in mini-app context
    // Next.js client-side navigation may not work properly in Farcaster mini-apps
    window.location.href = path;
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <div className="text-center w-full max-w-sm mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold mb-2">CryptoArt Studio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your creative toolkit for the decentralized web
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleNavigate("/studio")}
            className="btn btn-primary px-4 py-2 text-sm w-full max-w-xs mx-auto block text-center"
          >
            <Package className="mr-2 h-4 w-4 inline" />
            NFT Management Studio
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleNavigate("/subscribers")}
              className="btn btn-outline px-3 py-1.5 text-xs w-full text-center"
            >
              <Users className="mr-1 h-4 w-4 inline" />
              Subscribers
            </button>
            <button
              onClick={() => handleNavigate("/studio/settings")}
              className="btn btn-outline px-3 py-1.5 text-xs w-full text-center"
            >
              <Settings className="mr-1 h-4 w-4 inline" />
              Settings
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400">Powered by Neynar 🪐</p>
      </div>
    </div>
  );
} 