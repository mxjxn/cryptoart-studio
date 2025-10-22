"use client";

import Link from "next/link";
import { Button } from "~/components/ui/Button";
import { BarChart3, Users, Settings } from "lucide-react";

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
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)] px-6">
      <div className="text-center w-full max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">CryptoArt Studio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your creative toolkit for the decentralized web
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/dashboard">
            <Button className="w-full">
              <BarChart3 className="mr-2 h-4 w-4" />
              Creator Studio Dashboard
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/subscriptions">
              <Button variant="outline" className="w-full">
                <Users className="mr-2 h-4 w-4" />
                Subscriptions
              </Button>
            </Link>
            <Link href="/dashboard/settings">
              <Button variant="outline" className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-400">Powered by Neynar 🪐</p>
      </div>
    </div>
  );
} 