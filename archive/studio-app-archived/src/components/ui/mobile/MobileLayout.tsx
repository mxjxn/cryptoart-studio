"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/Button";
import { ArrowLeft, Home, BarChart3, Settings, Users } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  showBottomNav?: boolean;
  breadcrumbs?: Breadcrumb[];
  headerActions?: React.ReactNode;
}

export function MobileLayout({ 
  children, 
  title = "Creator Studio",
  showBackButton = false,
  backHref = "/",
  showBottomNav = true,
  breadcrumbs = [],
  headerActions
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState('studio');

  const navigation = [
    { id: 'studio', name: 'Studio', href: '/studio', icon: BarChart3 },
    { id: 'subscribers', name: 'Subscribers', href: '/subscribers', icon: Users },
    { id: 'settings', name: 'Settings', href: '/studio/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              {showBackButton && (
                <Link href={backHref} className="mr-3 flex-shrink-0">
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                {breadcrumbs.length > 0 ? (
                  <nav className="flex items-center text-xs text-gray-500 mb-1" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-1 overflow-x-auto">
                      {breadcrumbs.map((crumb, index) => (
                        <li key={index} className="flex items-center flex-shrink-0">
                          {index > 0 && <span className="mx-1">›</span>}
                          {crumb.href ? (
                            <Link href={crumb.href} className="hover:text-gray-700 truncate">
                              {crumb.label}
                            </Link>
                          ) : (
                            <span className="text-gray-900 font-medium truncate">{crumb.label}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </nav>
                ) : null}
                <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {/* Header actions (e.g., Create button) */}
              {headerActions}
              
              {/* Back to main app button */}
              <Link 
                href="/"
                className="btn btn-outline px-3 py-1.5 text-xs inline-flex items-center"
              >
                <Home className="mr-1 h-4 w-4" />
                App
              </Link>
            </div>
          </div>
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


