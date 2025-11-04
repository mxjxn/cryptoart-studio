"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/Button";
import { ArrowLeft, Home, BarChart3, Settings, Users } from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  showBottomNav?: boolean;
}

export function MobileLayout({ 
  children, 
  title = "Creator Studio",
  showBackButton = false,
  backHref = "/",
  showBottomNav = true
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { id: 'subscribers', name: 'Subscribers', href: '/subscribers', icon: Users },
    { id: 'settings', name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center">
            {showBackButton && (
              <Link href={backHref} className="mr-3">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
            )}
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          </div>
          
          {/* Back to main app button */}
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="mr-1 h-4 w-4" />
              App
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <main className="pb-20">
        <div className="px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
          <div className="flex justify-around items-center h-16">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


