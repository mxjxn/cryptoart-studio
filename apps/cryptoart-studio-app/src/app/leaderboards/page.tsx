"use client";

import { useState } from "react";
import { AuthWrapper } from "~/components/AuthWrapper";
import { MobileLayout } from "~/components/ui/mobile/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type TabType = "curators" | "artists" | "collectors" | "milestones";

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("curators");

  const tabs = [
    { id: "curators" as TabType, label: "Curators" },
    { id: "artists" as TabType, label: "Artists" },
    { id: "collectors" as TabType, label: "Collectors" },
    { id: "milestones" as TabType, label: "Recent Milestones" },
  ];

  return (
    <AuthWrapper>
      <MobileLayout title="Leaderboards" showBottomNav={false}>
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === "curators" && <CuratorsTab />}
            {activeTab === "artists" && <ArtistsTab />}
            {activeTab === "collectors" && <CollectorsTab />}
            {activeTab === "milestones" && <MilestonesTab />}
          </div>
        </div>
      </MobileLayout>
    </AuthWrapper>
  );
}

function CuratorsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Curators</CardTitle>
        <p className="text-sm text-gray-500">
          Curators ranked by commissions earned
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p>Curator leaderboard coming soon</p>
            <p className="text-xs mt-2">
              Track commissions earned through curation referrals
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArtistsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Artists</CardTitle>
        <p className="text-sm text-gray-500">
          Artists ranked by collectors, volume, and growth
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p>Artist leaderboard coming soon</p>
            <p className="text-xs mt-2">
              Track most collectors, highest volume, fastest growth
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CollectorsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Collectors</CardTitle>
        <p className="text-sm text-gray-500">
          Collectors ranked by patron level, artists supported, and discovery rate
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p>Collector leaderboard coming soon</p>
            <p className="text-xs mt-2">
              Track patron level, artists supported, best discovery rate
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MilestonesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Milestones</CardTitle>
        <p className="text-sm text-gray-500">
          New leaderboard entries and breakout artists
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p>Milestones feed coming soon</p>
            <p className="text-xs mt-2">
              Track new leaderboard entries and breakout artists
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

