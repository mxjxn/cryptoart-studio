"use client";

import Link from "next/link";
import { ArrowRight, Users, Rocket, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Forecaster
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Create and manage subscription NFTs on Farcaster. Powered by STP v2.
          </p>
        </header>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Creator Card */}
          <Link
            href="/creator/deploy"
            className="group block p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-500"
          >
            <div className="flex items-center justify-between mb-4">
              <Rocket className="w-12 h-12 text-purple-600" />
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              For Creators
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Deploy your subscription contract, set up tiers, and monetize your content
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-sm rounded-full">
                Deploy Contract
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-sm rounded-full">
                Set Tiers
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-sm rounded-full">
                Manage Subscribers
              </span>
            </div>
          </Link>

          {/* Subscriber Card */}
          <Link
            href="/subscribe"
            className="group block p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-green-500"
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-12 h-12 text-green-600" />
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              For Subscribers
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Browse creators, subscribe to your favorites, and earn rewards
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm rounded-full">
                Browse Creators
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm rounded-full">
                Subscribe
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm rounded-full">
                Earn Rewards
              </span>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Why Forecaster?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Multi-Tier Subscriptions
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Create multiple subscription tiers with different pricing and benefits
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Reward Loyal Subscribers
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Share revenue with subscribers through reward pools and referrals
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Easy to Deploy
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                Launch your subscription in minutes with our simple deployment flow
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
